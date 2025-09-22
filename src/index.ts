import * as cheerio from 'cheerio'
import { Browser, Page } from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

// Add stealth plugin to avoid detection
puppeteerExtra.use(StealthPlugin())

class SakuraMangaRepoPlugin implements IRepoPluginRepository {
  public RepoName = 'Sakura Manga'
  public RepoTag = 'sakuramanga'
  public RepoUrl = 'https://sakuramangas.org/'
  public methods: IRepoPluginMethods

  private browser: Browser | null = null
  private page: Page | null = null
  private sessionEstablished = false
  private chaptersLoading = false
  private userInteraction: IUserInteractionCallback | null = null

  constructor(userInteractionCallback?: IUserInteractionCallback) {
    this.userInteraction = userInteractionCallback || null
    this.methods = {
      getList: () => this.getList(),
      search: (input) => this.search({ query: input.search }),
      getDetails: (input) => this.getDetails({ siteId: input.siteId || '' }),
      getChapters: (input) => this.getChapters(input),
      getPages: (input) => this.getPages(input)
    }
  }

  // Get list of manga (not implemented)
  async getList(): Promise<IComic[]> {
    return []
  }

  // Initialize browser with enhanced stealth
  private async initBrowser(forceVisible = false): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteerExtra.launch({
        headless: true, // Use headless mode with stealth plugin to avoid detection
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      })

      this.page = await this.browser.newPage()
      await this.page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
      await this.page.setViewport({ width: 1920, height: 1080 })
    }
  }

  // Establish session with Cloudflare bypass
  private async establishSession(): Promise<void> {
    if (this.sessionEstablished) return

    console.log('🛡️ Establishing Cloudflare session...')
    if (this.userInteraction) {
      await this.userInteraction.showProgress('Connecting to SakuraManga...')
    }

    await this.initBrowser()

    try {
      await this.page!.goto(this.RepoUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000
      })

      console.log('Waiting for Cloudflare (30 seconds)...')
      if (this.userInteraction) {
        await this.userInteraction.showProgress('Processing Cloudflare security check...')
      }

      await new Promise((resolve) => setTimeout(resolve, 30000))

      let title = await this.page!.title()
      let cookies = await this.page!.cookies()

      console.log(`Page title after 30s: "${title}"`)
      console.log(`Session cookies: ${cookies.length}`)

      if (title.includes('Just a moment') || title.includes('Um momento') || cookies.length === 0) {
        console.log('Cloudflare challenge detected, requesting user interaction...')

        if (this.userInteraction) {
          const challengeResolved = await this.userInteraction.showCloudflareChallenge({
            type: 'challenge',
            url: this.RepoUrl,
            title: 'SakuraManga Cloudflare Challenge',
            message:
              'Please complete the Cloudflare verification to access SakuraManga. The challenge may take a few moments to resolve automatically.',
            requiresUserInteraction: true
          })

          if (challengeResolved) {
            console.log('✅ User acknowledged Cloudflare challenge')
            await this.userInteraction.showProgress('Waiting for challenge to resolve...')

            // Wait longer for the challenge to resolve naturally
            let challengeResolved = false
            let attempts = 0
            const maxAttempts = 30 // 3 minutes total

            while (!challengeResolved && attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 6000)) // Wait 6 seconds each time
              attempts++

              try {
                title = await this.page!.title()
                cookies = await this.page!.cookies()

                console.log(
                  `   Challenge check ${attempts}/${maxAttempts}: "${title}", cookies: ${cookies.length}`
                )

                if (title.includes('Sakura Mangás') || title.includes('Sakura Mangas')) {
                  challengeResolved = true
                  console.log('✅ Challenge resolved automatically!')
                } else if (title.includes('Just a moment') || title.includes('Um momento')) {
                  console.log('   🔄 Still on challenge page, waiting...')
                  await this.userInteraction.showProgress(
                    `Waiting for challenge resolution... (${attempts}/${maxAttempts})`
                  )
                } else {
                  console.log('   ❓ Unexpected page state, continuing...')
                }
              } catch (error: any) {
                console.log(`   ⚠️  Error checking challenge status: ${error?.message || error}`)
                // Continue waiting
              }
            }

            if (!challengeResolved) {
              console.log('⚠️  Challenge did not resolve automatically')
              console.log('   This is normal - some challenges require manual intervention')
              throw new Error('Cloudflare challenge did not resolve automatically')
            }
          } else {
            console.log('❌ User cancelled Cloudflare challenge')
            throw new Error('Cloudflare challenge not completed')
          }
        } else {
          console.log('No user interaction callback, showing browser window...')
          await this.showBrowserForUserInteraction()
          console.log('Waiting additional 20 seconds for challenge resolution...')
          await new Promise((resolve) => setTimeout(resolve, 20000))

          title = await this.page!.title()
          cookies = await this.page!.cookies()
          console.log(`Page title after 50s total: "${title}"`)
          console.log(`Session cookies: ${cookies.length}`)
        }
      }

      if (title.includes('Sakura Mangás') && cookies.length > 0) {
        console.log('✅ Session established successfully!')
        this.sessionEstablished = true
      } else {
        throw new Error(
          `Failed to establish session. Title: "${title}", Cookies: ${cookies.length}`
        )
      }
    } catch (error: any) {
      console.log(`Session establishment error: ${error?.message || error}`)
      throw error
    }
  }

  // Show browser for user interaction when needed
  private async showBrowserForUserInteraction(): Promise<void> {
    if (this.browser && this.page) {
      // Create a new visible browser window for user interaction
      const visibleBrowser = await puppeteerExtra.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      })

      const visiblePage = await visibleBrowser.newPage()
      await visiblePage.goto(this.RepoUrl)

      // Wait for user to complete challenge
      await new Promise((resolve) => setTimeout(resolve, 30000))

      // Copy cookies from visible browser to hidden browser
      const cookies = await visiblePage.cookies()
      await this.page.setCookie(...cookies)

      await visibleBrowser.close()
    }
  }

  // Search for manga
  async search(input: { query: string }): Promise<IComic[]> {
    console.log(`Searching for: ${input.query}`)
    await this.establishSession()

    try {
      const searchUrl = `${this.RepoUrl}buscar?q=${encodeURIComponent(input.query)}`
      await this.page!.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const content = await this.page!.content()
      const $ = cheerio.load(content)

      const comics: IComic[] = []

      $('.obra-item').each((index, element) => {
        const $el = $(element)
        const title = $el.find('.obra-titulo').text().trim()
        const link = $el.find('a').attr('href')
        const image = $el.find('img').attr('src')

        if (title && link) {
          comics.push({
            name: title,
            siteId: link,
            siteLink: link.startsWith('http') ? link : `${this.RepoUrl.replace(/\/$/, '')}${link}`,
            cover: image
              ? image.startsWith('http')
                ? image
                : `${this.RepoUrl.replace(/\/$/, '')}${image}`
              : '',
            synopsis: '',
            type: 'manga',
            repo: this.RepoTag
          })
        }
      })

      console.log(`Found ${comics.length} comics`)
      return comics
    } catch (error: any) {
      console.log(`Search error: ${error?.message || error}`)
      return []
    }
  }

  // Get manga details
  async getDetails(input: { siteId: string }): Promise<Partial<IComic>> {
    console.log(`Getting details for: ${input.siteId}`)
    await this.establishSession()

    try {
      const mangaUrl = input.siteId.startsWith('http')
        ? input.siteId
        : `${this.RepoUrl.replace(/\/$/, '')}${input.siteId}`
      await this.page!.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const content = await this.page!.content()
      const $ = cheerio.load(content)

      const title = $('.obra-titulo').text().trim()
      const description = $('.obra-sinopse').text().trim()
      const image = $('.obra-capa img').attr('src')

      if (title) {
        return {
          name: title,
          siteId: input.siteId,
          siteLink: mangaUrl,
          synopsis: description || '',
          cover: image
            ? image.startsWith('http')
              ? image
              : `${this.RepoUrl.replace(/\/$/, '')}${image}`
            : '',
          type: 'manga',
          repo: this.RepoTag
        }
      }

      return {}
    } catch (error: any) {
      console.log(`Details error: ${error?.message || error}`)
      return {}
    }
  }

  // Get chapters with stealth plugin
  async getChapters(input: { siteId: string }): Promise<IChapter[]> {
    if (this.chaptersLoading) {
      console.log('Chapters already loading, skipping...')
      return []
    }

    this.chaptersLoading = true
    console.log(`Getting chapters for: ${input.siteId}`)

    try {
      await this.establishSession()

      const mangaUrl = input.siteId.startsWith('http')
        ? input.siteId
        : `${this.RepoUrl.replace(/\/$/, '')}${input.siteId}`
      await this.page!.goto(mangaUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      await new Promise((resolve) => setTimeout(resolve, 5000))

      // Check if we need to click ver-mais button
      const hasVerMais = await this.page!.evaluate(() => {
        const button = document.getElementById('ver-mais')
        return !!button
      })

      if (hasVerMais) {
        console.log('🔄 Clicking ver-mais button to load all chapters...')

        // Click the ver-mais button
        await this.page!.click('#ver-mais')
        await new Promise((resolve) => setTimeout(resolve, 3000))

        // Handle potential ad popup
        const pages = await this.browser!.pages()
        if (pages.length > 1) {
          console.log('📱 Ad popup detected, closing...')
          await pages[pages.length - 1].close()
          await new Promise((resolve) => setTimeout(resolve, 1000))

          // Click ver-mais again
          await this.page!.click('#ver-mais')
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }

      const content = await this.page!.content()
      const $ = cheerio.load(content)

      const chapters: IChapter[] = []

      $('.capitulo-item').each((index, element) => {
        const $el = $(element)
        const link = $el.find('a').attr('href')
        const titleEl = $el.find('.cap-titulo')
        const numberEl = $el.find('.num-capitulo')

        if (link) {
          const chapterNumber = numberEl.attr('data-chapter') || numberEl.text().trim()
          const chapterTitle = titleEl.text().trim()

          const finalTitle =
            chapterTitle && chapterTitle.length > 0 ? chapterTitle : `Capítulo ${chapterNumber}`

          chapters.push({
            name: finalTitle,
            siteId: link,
            siteLink: link.startsWith('http') ? link : `${this.RepoUrl.replace(/\/$/, '')}${link}`,
            number: chapterNumber,
            repo: this.RepoTag
          })
        }
      })

      console.log(`Found ${chapters.length} chapters`)
      return chapters
    } catch (error: any) {
      console.log(`Chapters error: ${error?.message || error}`)
      return []
    } finally {
      this.chaptersLoading = false
    }
  }

  // Get pages (HTML parsing)
  async getPages(input: { siteLink: string }): Promise<IPage[]> {
    const chapterId = input.siteLink
    console.log(`Getting pages for chapter: ${chapterId}`)

    await this.establishSession()

    try {
      const chapterUrl = chapterId.startsWith('http')
        ? chapterId
        : `${this.RepoUrl.replace(/\/$/, '')}${chapterId}`
      await this.page!.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      await new Promise((resolve) => setTimeout(resolve, 3000))

      const content = await this.page!.content()
      const $ = cheerio.load(content)

      const pages: IPage[] = []

      $('.pagina img').each((index, element) => {
        const $el = $(element)
        const src = $el.attr('src') || $el.attr('data-src')

        if (src) {
          const imageUrl = src.startsWith('http') ? src : `${this.RepoUrl.replace(/\/$/, '')}${src}`
          pages.push({
            filename: `page_${index + 1}.jpg`,
            path: imageUrl
          })
        }
      })

      console.log(`Found ${pages.length} pages`)
      return pages
    } catch (error: any) {
      console.log(`Pages error: ${error?.message || error}`)
      return []
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    this.sessionEstablished = false
  }
}

export default SakuraMangaRepoPlugin
