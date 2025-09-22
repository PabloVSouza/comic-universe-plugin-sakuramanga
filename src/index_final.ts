import * as cheerio from 'cheerio'
import puppeteer, { Browser, Page } from 'puppeteer'

class SakuraMangaRepoPlugin implements IRepoPluginRepository {
  public RepoName = 'Sakura Manga'
  public RepoTag = 'sakuramanga'
  public RepoUrl = 'https://sakuramangas.org/'

  private browser: Browser | null = null
  private page: Page | null = null
  private userInteraction?: IUserInteractionCallback
  private cookies: any[] = []
  private securityTokens: any = {}

  constructor(data?: IRepoPluginRepositoryInit) {
    this.userInteraction = data?.userInteraction
  }

  // Initialize browser
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-blink-features=AutomationControlled',
          '--no-default-browser-check'
        ]
      })
    }

    if (!this.page) {
      this.page = await this.browser.newPage()

      // Hide automation indicators
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        })

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        })
      })

      // Set realistic viewport and user agent
      await this.page.setViewport({ width: 1920, height: 1080 })
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      // Set additional headers
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      })

      // Enable request interception
      await this.page.setRequestInterception(true)

      this.page.on('request', (request) => {
        const delay = Math.random() * 100 + 50
        setTimeout(() => {
          request.continue()
        }, delay)
      })
    }
  }

  // Clean up browser resources
  private async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  // Extract security tokens from the page
  private async extractSecurityTokens(): Promise<void> {
    if (!this.page) return

    try {
      console.log('Extracting security tokens from page...')

      const tokens = await this.page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
        let csrfToken = ''
        let verificationKey1 = ''
        let verificationKey2 = ''
        let challenge = ''
        let proof = ''

        // Check meta tags first
        const csrfMeta = document.querySelector('meta[name="csrf-token"]')
        if (csrfMeta) {
          csrfToken = csrfMeta.getAttribute('content') || ''
        }

        // Look in script tags for tokens
        for (const script of scripts) {
          const content = script.textContent || ''

          const csrfMatch = content.match(/csrf[_-]?token['"]?\s*[:=]\s*['"]([^'"]+)['"]/i)
          if (csrfMatch) csrfToken = csrfMatch[1]

          const key1Match = content.match(
            /verification[_-]?key[_-]?1['"]?\s*[:=]\s*['"]([^'"]+)['"]/i
          )
          if (key1Match) verificationKey1 = key1Match[1]

          const key2Match = content.match(
            /verification[_-]?key[_-]?2['"]?\s*[:=]\s*['"]([^'"]+)['"]/i
          )
          if (key2Match) verificationKey2 = key2Match[1]

          const challengeMatch = content.match(/challenge['"]?\s*[:=]\s*['"]([^'"]+)['"]/i)
          if (challengeMatch) challenge = challengeMatch[1]

          const proofMatch = content.match(/proof['"]?\s*[:=]\s*['"]([^'"]+)['"]/i)
          if (proofMatch) proof = proofMatch[1]
        }

        return {
          csrfToken:
            csrfToken || '2f71324a76c6ecf3d4f4015f1b97ca4140fae04b94434b0bf241b1911c1ca273',
          verificationKey1: verificationKey1 || 'a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8',
          verificationKey2: verificationKey2 || 'z9y8x7w6-v5u4-3210-t9s8-r7q6p5o4n3m2',
          challenge:
            challenge ||
            'MjAwMTo4YTA6ZjRmOTo2ZDAwOjUxZmY6NDgxNTpiNDQ5OmE4OWQvNDQ2MWQxNzljZDk4NWNiYWYwZmFkZTljY2FhZDdkMzc4N2NjMGM2Zi85MDdhNTcxN2U0NWEyNWFkOTg4N2JjNmMxYjkyMTM1Yw%3D%3D',
          proof: proof || '895df971e8574a61ad4438a0d7990de3078177b285fa7ef73e632ff3ffc14184'
        }
      })

      this.securityTokens = tokens
      console.log('Security tokens extracted:', Object.keys(tokens))
    } catch (error) {
      console.error('Failed to extract security tokens:', error)
    }
  }

  // Make request using Puppeteer to handle Cloudflare
  private async makeRequest(url: string, maxRetries: number = 3): Promise<string> {
    await this.initBrowser()

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.page) throw new Error('Page not initialized')

        console.log(`Attempting to load: ${url} (attempt ${attempt})`)

        const preDelay = Math.random() * 1000 + 500
        await new Promise((resolve) => setTimeout(resolve, preDelay))

        const response = await this.page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })

        if (!response) {
          throw new Error('No response received from server')
        }

        const status = response.status()
        console.log(`Response status: ${status}`)

        if (status >= 400 && status !== 403) {
          throw new Error(`HTTP ${status}: ${response.statusText()}`)
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))

        const title = await this.page.title()
        const content = await this.page.content()

        const isCloudflareChallenge =
          title.includes('Just a moment') ||
          title.includes('Attention Required') ||
          content.includes('cf-browser-verification') ||
          content.includes('challenge-platform') ||
          status === 403

        if (isCloudflareChallenge) {
          console.log(
            `Cloudflare challenge detected, using automatic bypass... (attempt ${attempt})`
          )

          await new Promise((resolve) => setTimeout(resolve, 5000))

          const newTitle = await this.page.title()
          const newContent = await this.page.content()

          const stillChallenge =
            newTitle.includes('Just a moment') ||
            newTitle.includes('Attention Required') ||
            newContent.includes('cf-browser-verification')

          if (stillChallenge) {
            if (attempt === maxRetries) {
              throw new Error('Could not bypass Cloudflare challenge automatically')
            }
            console.log('Challenge still active, retrying...')
            continue
          } else {
            console.log('Cloudflare challenge bypassed automatically')
            this.cookies = await this.page.cookies()
            await this.extractSecurityTokens()
          }
        }

        const pageContent = await this.page.content()
        console.log(`Successfully loaded page: ${title}`)

        return pageContent
      } catch (error) {
        console.error(`Request attempt ${attempt} failed:`, error)
        if (attempt === maxRetries) {
          console.log('Max retries reached, returning graceful fallback')
          return '<html><body>Error loading page</body></html>'
        }

        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
      }
    }

    return '<html><body>Error loading page</body></html>'
  }

  private extractIdFromUrl = (url: string): string => {
    const patterns = [/\/obras\/([^\/]+)/, /\/manga\/([^\/]+)/, /\/(\d+)/, /\/([^\/]+)$/]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return url.split('/').filter(Boolean).pop() || ''
  }

  public methods: IRepoPluginMethods = {
    getList: async (): Promise<IComic[]> => {
      console.log('getList is disabled for SakuraManga - please use search instead')
      return []
    },

    search: async ({ search }): Promise<IComic[]> => {
      try {
        console.log(`Searching for: ${search}`)

        // Get cookies first if we don't have them
        if (this.cookies.length === 0) {
          await this.makeRequest(this.RepoUrl)
        }

        // Use the search API endpoint
        const apiPage = await this.browser!.newPage()

        try {
          if (this.cookies.length > 0) {
            await apiPage.setCookie(...this.cookies)
          }

          const searchUrl = `${
            this.RepoUrl
          }dist/sakura/global/sidebar/sidebar.php?q=${encodeURIComponent(search)}`
          const response = await apiPage.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          })

          if (response && response.ok()) {
            const text = await apiPage.evaluate(() => document.body.textContent || '')
            const searchResults = JSON.parse(text)

            if (Array.isArray(searchResults)) {
              const comics: IComic[] = searchResults
                .map((item: any) => {
                  const siteLink = item.url || ''
                  const cover = item.thumb_url || ''

                  return {
                    name: item.titulo || '',
                    siteId: siteLink, // Store the full URL path as siteId
                    siteLink: siteLink,
                    cover: cover.startsWith('/') ? this.RepoUrl + cover : cover,
                    type: 'manga',
                    synopsis: `${item.demografia || ''} • ${item.status || ''} • ${
                      item.ano || ''
                    }`.trim(),
                    repo: this.RepoTag
                  } as IComic
                })
                .filter((comic): comic is IComic => comic !== null && comic.name.length > 0)
                .slice(0, 15)

              console.log(`Found ${comics.length} comics via API`)
              return comics
            }
          }
        } finally {
          await apiPage.close()
        }

        return []
      } catch (error) {
        console.error('Error in search:', error)
        return []
      }
    },

    getDetails: async (search): Promise<Partial<IComic>> => {
      try {
        console.log('Getting details for comic:', search)

        // Load the manga page first to get context and tokens
        const fullUrl = search.siteLink.startsWith('/')
          ? this.RepoUrl.replace(/\/$/, '') + search.siteLink
          : this.RepoUrl + search.siteLink
        console.log(`Loading manga page: ${fullUrl}`)

        const html = await this.makeRequest(fullUrl)
        await this.extractSecurityTokens()

        // Extract manga ID from the page
        const mangaId = await this.page!.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script'))
          for (const script of scripts) {
            const content = script.textContent || ''
            const idMatch = content.match(/manga[_-]?id['"]?\s*[:=]\s*['"]?(\d+)['"]?/i)
            if (idMatch) return idMatch[1]
          }
          return null
        })

        if (mangaId && this.securityTokens.challenge) {
          // Try API with fresh tokens
          try {
            const apiPage = await this.browser!.newPage()

            try {
              if (this.cookies.length > 0) {
                await apiPage.setCookie(...this.cookies)
              }

              await apiPage.setExtraHTTPHeaders({
                accept: 'application/json, text/javascript, */*; q=0.01',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                referer: fullUrl,
                origin: this.RepoUrl.replace(/\/$/, '')
              })

              const postData = {
                manga_id: mangaId,
                dataType: 'json',
                challenge: this.securityTokens.challenge,
                proof: this.securityTokens.proof
              }

              const formData = new URLSearchParams(postData).toString()
              const apiUrl = `${this.RepoUrl}dist/sakura/models/manga/__obf__manga_info.php`

              const apiDetails = await apiPage.evaluate(
                async (url, data) => {
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'X-Requested-With': 'XMLHttpRequest',
                      Accept: 'application/json, text/javascript, */*; q=0.01'
                    },
                    body: data,
                    credentials: 'include'
                  })

                  if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
                  }

                  const text = await resp.text()
                  return JSON.parse(text)
                },
                apiUrl,
                formData
              )

              if (apiDetails && typeof apiDetails === 'object') {
                console.log('Found details via API')
                return {
                  synopsis: apiDetails.sinopse || 'No synopsis available',
                  genres:
                    apiDetails.tags && Array.isArray(apiDetails.tags)
                      ? JSON.stringify(apiDetails.tags)
                      : null,
                  author: apiDetails.autor || null,
                  status: apiDetails.status || null,
                  type: 'manga'
                }
              }
            } finally {
              await apiPage.close()
            }
          } catch (error) {
            console.log('Details API failed:', error)
          }
        }

        // Fallback to HTML parsing
        const $ = cheerio.load(html)

        const synopsis =
          $('.summary .description, .manga-summary, .synopsis').first().text().trim() ||
          'No synopsis available'
        const genreElements = $('.genres a, .tags a').toArray()
        const genres =
          genreElements.length > 0
            ? JSON.stringify(genreElements.map((el) => $(el).text().trim()))
            : null
        const author = $('.author a, .manga-author').first().text().trim() || null
        const status = $('.status, .manga-status').first().text().trim() || null

        return {
          synopsis,
          genres,
          author,
          status,
          type: 'manga'
        }
      } catch (error) {
        console.error('Error in getDetails:', error)
        return {
          synopsis: 'Details temporarily unavailable',
          type: 'manga'
        }
      }
    },

    getChapters: async ({ siteId }): Promise<IChapter[]> => {
      try {
        console.log('Getting chapters for siteId:', siteId)

        // siteId is the URL path like "/obras/world-trigger"
        const fullUrl = siteId.startsWith('/')
          ? this.RepoUrl.replace(/\/$/, '') + siteId
          : this.RepoUrl + siteId
        console.log(`Loading manga page: ${fullUrl}`)

        const html = await this.makeRequest(fullUrl)
        await this.extractSecurityTokens()

        // Extract manga ID from the page
        const mangaId = await this.page!.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script'))
          for (const script of scripts) {
            const content = script.textContent || ''
            const idMatch = content.match(/manga[_-]?id['"]?\s*[:=]\s*['"]?(\d+)['"]?/i)
            if (idMatch) return idMatch[1]
          }
          return null
        })

        if (mangaId && this.securityTokens.challenge) {
          // Try chapters API
          try {
            const apiPage = await this.browser!.newPage()

            try {
              if (this.cookies.length > 0) {
                await apiPage.setCookie(...this.cookies)
              }

              await apiPage.setExtraHTTPHeaders({
                accept: 'text/html, */*; q=0.01',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'x-requested-with': 'XMLHttpRequest',
                referer: fullUrl,
                origin: this.RepoUrl.replace(/\/$/, '')
              })

              const postData = {
                manga_id: mangaId,
                offset: '0',
                order: 'desc',
                limit: '90',
                challenge: this.securityTokens.challenge,
                proof: this.securityTokens.proof
              }

              const formData = new URLSearchParams(postData).toString()
              const apiUrl = `${this.RepoUrl}dist/sakura/models/manga/__obf__manga_capitulos.php`

              const chaptersHtml = await apiPage.evaluate(
                async (url, data) => {
                  const resp = await fetch(url, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                      'X-Requested-With': 'XMLHttpRequest',
                      Accept: 'text/html, */*; q=0.01'
                    },
                    body: data,
                    credentials: 'include'
                  })

                  if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
                  }

                  return await resp.text()
                },
                apiUrl,
                formData
              )

              if (chaptersHtml && chaptersHtml.includes('capitulo-item')) {
                console.log('Found chapters via API')
                const $ = cheerio.load(chaptersHtml)
                const chapters: IChapter[] = []

                $('.capitulo-item').each((index, element) => {
                  const $element = $(element)
                  const chapterNumber = $element.find('.num-capitulo').attr('data-chapter') || ''
                  const chapterLink = $element.find('.num-capitulo a').attr('href') || ''
                  const chapterTitle =
                    $element.find('.cap-titulo').text().trim() || `Capítulo ${chapterNumber}`
                  const dateText = $element.find('.cap-data span').last().text().trim() || ''

                  if (chapterNumber && chapterLink) {
                    const chapterSiteId = this.extractIdFromUrl(chapterLink)

                    chapters.push({
                      siteId: chapterSiteId,
                      siteLink: siteId,
                      number: chapterNumber,
                      name: chapterTitle,
                      date: dateText || null,
                      repo: this.RepoTag
                    } as IChapter)
                  }
                })

                if (chapters.length > 0) {
                  console.log(`Found ${chapters.length} chapters via API`)
                  return chapters.sort((a, b) => parseFloat(b.number) - parseFloat(a.number))
                }
              }
            } finally {
              await apiPage.close()
            }
          } catch (error) {
            console.log('Chapters API failed:', error)
          }
        }

        // Fallback to HTML parsing
        console.log('Using HTML parsing for chapters')
        const $ = cheerio.load(html)

        const chapterSelectors = [
          '.chapter-list .chapter',
          '.chapters .chapter',
          '.chapter-item',
          'a[href*="chapter"]',
          'a[href*="capitulo"]'
        ]

        for (const selector of chapterSelectors) {
          const elements = $(selector).toArray()
          if (elements.length > 0) {
            const chapters = elements
              .map((element, index) => {
                const $element = $(element)
                const chapterLink = $element.attr('href') || $element.find('a').attr('href') || ''
                const chapterTitle = $element.text().trim()
                const numberMatch = chapterTitle.match(/(\d+(?:\.\d+)?)/i)
                const chapterNumber = numberMatch ? numberMatch[1] : String(index + 1)

                if (chapterLink) {
                  return {
                    siteId: this.extractIdFromUrl(chapterLink),
                    siteLink: siteId,
                    number: chapterNumber,
                    name: chapterTitle || `Chapter ${chapterNumber}`,
                    date: null,
                    repo: this.RepoTag
                  } as IChapter
                }
                return null
              })
              .filter((chapter): chapter is IChapter => chapter !== null)
              .sort((a, b) => parseFloat(b.number) - parseFloat(a.number))

            if (chapters.length > 0) {
              console.log(`Found ${chapters.length} chapters via HTML`)
              return chapters
            }
          }
        }

        return []
      } catch (error) {
        console.error('Error in getChapters:', error)
        return []
      }
    },

    getPages: async ({ siteLink }: { siteLink: string }): Promise<IPage[]> => {
      try {
        const chapterUrl = siteLink.startsWith('/')
          ? this.RepoUrl.replace(/\/$/, '') + siteLink
          : this.RepoUrl + siteLink

        const html = await this.makeRequest(chapterUrl)
        const $ = cheerio.load(html)

        const imageSelectors = [
          '.reading-content img',
          '.chapter-content img',
          '.reader-content img',
          '#readerarea img',
          'img[src*="manga"]'
        ]

        for (const selector of imageSelectors) {
          const images = $(selector).toArray()
          if (images.length > 0) {
            const pages = images
              .map((element, index) => {
                const $element = $(element)
                let imageSrc = $element.attr('src') || $element.attr('data-src') || ''

                if (!imageSrc) return null

                if (imageSrc.startsWith('//')) {
                  imageSrc = 'https:' + imageSrc
                } else if (imageSrc.startsWith('/')) {
                  imageSrc = this.RepoUrl.replace(/\/$/, '') + imageSrc
                } else if (!imageSrc.startsWith('http')) {
                  imageSrc = this.RepoUrl.replace(/\/$/, '') + '/' + imageSrc
                }

                return {
                  path: imageSrc,
                  filename: imageSrc.split('/').pop() || `page-${index + 1}.jpg`
                } as IPage
              })
              .filter((page): page is IPage => page !== null)
              .filter((page) => {
                const url = page.path.toLowerCase()
                return (
                  !url.includes('logo') &&
                  !url.includes('banner') &&
                  (url.includes('jpg') || url.includes('png') || url.includes('webp'))
                )
              })

            if (pages.length > 0) {
              console.log(`Found ${pages.length} pages`)
              return pages
            }
          }
        }

        return []
      } catch (error) {
        console.error('Error in getPages:', error)
        return []
      } finally {
        await this.closeBrowser()
      }
    }
  }
}

export default SakuraMangaRepoPlugin

