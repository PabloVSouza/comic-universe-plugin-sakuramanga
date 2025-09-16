import axios, { AxiosInstance } from 'axios'
import * as cheerio from 'cheerio'

// Add cookie jar support for session management
const axiosDefault = axios.create()

class SakuraMangaRepoPlugin implements IRepoPluginRepository {
  public RepoName = 'Sakura Manga'
  public RepoTag = 'sakuramanga'
  public RepoUrl = 'https://sakuramangas.org/'

  private axios: AxiosInstance

  // Helper method to detect Cloudflare challenge
  private isCloudflareChallenge(html: string): boolean {
    return (
      html.includes('Just a moment...') ||
      html.includes('challenge-platform') ||
      html.includes('__cf_chl_opt') ||
      html.includes('Enable JavaScript and cookies to continue')
    )
  }

  // Helper method to make requests with retry logic
  private async makeRequest(url: string, maxRetries: number = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add delay between attempts to avoid rate limiting
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
        }

        const response = await this.axios.get(url)

        if (this.isCloudflareChallenge(response.data)) {
          console.warn(`Cloudflare challenge detected on attempt ${attempt} for URL: ${url}`)
          if (attempt === maxRetries) {
            throw new Error('Cloudflare protection active - cannot access website')
          }
          continue
        }

        return response.data
      } catch (error) {
        console.error(`Request attempt ${attempt} failed:`, error)
        if (attempt === maxRetries) {
          throw error
        }
      }
    }
    throw new Error('Max retries exceeded')
  }

  constructor(data: IRepoPluginRepositoryInit) {
    this.axios = axios.create({
      baseURL: this.RepoUrl,
      timeout: 30000, // Increased timeout for Cloudflare challenges
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      }
    })
  }

  private parseComicFromElement = ($: cheerio.CheerioAPI, element: any): IComic | null => {
    try {
      const $element = $(element)

      // Common patterns for manga cards
      const title =
        $element.find('h3, h4, .title, .manga-title, .entry-title').first().text().trim() ||
        $element.find('a').attr('title') ||
        $element.find('img').attr('alt') ||
        ''

      const link = $element.find('a').first().attr('href') || ''
      const cover =
        $element.find('img').first().attr('src') ||
        $element.find('img').first().attr('data-src') ||
        $element.find('img').first().attr('data-lazy-src') ||
        ''

      if (!title || !link) return null

      // Extract ID from URL
      const siteId = this.extractIdFromUrl(link)

      return {
        name: title,
        siteId,
        siteLink: link.replace(this.RepoUrl, ''),
        cover: cover.startsWith('http')
          ? cover
          : cover
          ? this.RepoUrl + cover.replace(/^\//, '')
          : '',
        type: 'manga',
        synopsis: '',
        repo: this.RepoTag
      }
    } catch (error) {
      console.error('Error parsing comic element:', error)
      return null
    }
  }

  private extractIdFromUrl = (url: string): string => {
    // Common patterns for extracting manga ID from URL
    const patterns = [
      /\/manga\/([^\/]+)/,
      /\/series\/([^\/]+)/,
      /\/title\/([^\/]+)/,
      /\/(\d+)/,
      /\/([^\/]+)$/
    ]

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
      try {
        const html = await this.makeRequest('/')
        const $ = cheerio.load(html)

        // Common selectors for manga listings
        const selectors = [
          '.manga-item',
          '.post-item',
          '.entry',
          '.manga-card',
          '.series-item',
          '.grid-item',
          'article',
          '.wp-block-group',
          '.elementor-widget-container .entry'
        ]

        let comics: IComic[] = []

        for (const selector of selectors) {
          const elements = $(selector).toArray()
          if (elements.length > 0) {
            comics = elements
              .map((element) => this.parseComicFromElement($, element))
              .filter((comic): comic is IComic => comic !== null)
              .slice(0, 20) // Limit to first 20 results

            if (comics.length > 0) break
          }
        }

        return comics
      } catch (error) {
        if (error instanceof Error && error.message.includes('Cloudflare protection')) {
          console.error(
            'SakuraManga Plugin: Website is protected by Cloudflare. This plugin may not work until the protection is bypassed.'
          )
          // Return empty array but log the issue
          return []
        }
        console.error('Error in getList:', error)
        return []
      }
    },

    search: async ({ search }): Promise<IComic[]> => {
      try {
        // Try common search URL patterns
        const searchPatterns = [
          `/?s=${encodeURIComponent(search)}`,
          `/search?q=${encodeURIComponent(search)}`,
          `/search/${encodeURIComponent(search)}`,
          `/?search=${encodeURIComponent(search)}`,
          `/buscar?q=${encodeURIComponent(search)}`
        ]

        for (const searchUrl of searchPatterns) {
          try {
            const html = await this.makeRequest(searchUrl)
            const $ = cheerio.load(html)

            // Try to find search results
            const selectors = [
              '.search-results .manga-item',
              '.search-results .post-item',
              '.search-results .entry',
              '.search-results article',
              '.manga-item',
              '.post-item',
              '.entry',
              'article'
            ]

            let comics: IComic[] = []

            for (const selector of selectors) {
              const elements = $(selector).toArray()
              if (elements.length > 0) {
                comics = elements
                  .map((element) => this.parseComicFromElement($, element))
                  .filter((comic): comic is IComic => comic !== null)
                  .filter((comic) => comic.name.toLowerCase().includes(search.toLowerCase()))
                  .slice(0, 15) // Limit search results

                if (comics.length > 0) return comics
              }
            }
          } catch (error) {
            // Continue to next search pattern
            continue
          }
        }

        return []
      } catch (error) {
        if (error instanceof Error && error.message.includes('Cloudflare protection')) {
          console.error('SakuraManga Plugin: Cannot search - website is protected by Cloudflare.')
          return []
        }
        console.error('Error in search:', error)
        return []
      }
    },

    getDetails: async (search): Promise<Partial<IComic>> => {
      try {
        const mangaUrl = search.siteLink.startsWith('/') ? search.siteLink : `/${search.siteLink}`
        const html = await this.makeRequest(mangaUrl)
        const $ = cheerio.load(html)

        // Try to extract synopsis from common selectors
        const synopsisSelectors = [
          '.summary .description',
          '.manga-summary',
          '.synopsis',
          '.description',
          '.summary',
          '.entry-content p',
          '.post-content p',
          '.content p',
          'meta[name="description"]'
        ]

        let synopsis = ''
        for (const selector of synopsisSelectors) {
          const element = $(selector).first()
          if (selector === 'meta[name="description"]') {
            synopsis = element.attr('content') || ''
          } else {
            synopsis = element.text().trim()
          }
          if (synopsis) break
        }

        // Try to extract genres
        const genreSelectors = [
          '.genres a',
          '.genre a',
          '.tags a',
          '.categories a',
          '.meta-genre a',
          '.wp-block-tag-cloud a'
        ]

        let genres: string[] = []
        for (const selector of genreSelectors) {
          const genreElements = $(selector).toArray()
          if (genreElements.length > 0) {
            genres = genreElements.map((el) => $(el).text().trim()).filter(Boolean)
            if (genres.length > 0) break
          }
        }

        // Try to extract author/artist
        const authorSelectors = ['.author a', '.manga-author', '.meta-author', '.artist']

        let author = ''
        for (const selector of authorSelectors) {
          author = $(selector).first().text().trim()
          if (author) break
        }

        // Try to extract status
        const statusSelectors = ['.status', '.manga-status', '.meta-status']

        let status = ''
        for (const selector of statusSelectors) {
          status = $(selector).first().text().trim()
          if (status) break
        }

        return {
          synopsis: synopsis || 'No synopsis available',
          genres: genres.length > 0 ? JSON.stringify(genres) : null,
          author: author || null,
          status: status || null,
          type: 'manga'
        }
      } catch (error) {
        console.error('Error in getDetails:', error)
        return {
          synopsis: 'No synopsis available',
          type: 'manga'
        }
      }
    },

    getChapters: async ({ siteId }): Promise<IChapter[]> => {
      try {
        // Try to construct manga URL from siteId
        const mangaUrlPatterns = [
          `/manga/${siteId}`,
          `/series/${siteId}`,
          `/title/${siteId}`,
          `/${siteId}`
        ]

        for (const mangaUrl of mangaUrlPatterns) {
          try {
            const html = await this.makeRequest(mangaUrl)
            const $ = cheerio.load(html)

            // Try to find chapter listings
            const chapterSelectors = [
              '.chapter-list .chapter',
              '.chapters .chapter',
              '.chapter-item',
              '.wp-manga-chapter',
              '.entry-chapters a',
              '.chapter-link',
              'a[href*="chapter"]',
              'a[href*="capitulo"]',
              '.version-chap a'
            ]

            let chapters: IChapter[] = []

            for (const selector of chapterSelectors) {
              const chapterElements = $(selector).toArray()

              if (chapterElements.length > 0) {
                chapters = chapterElements
                  .map((element, index) => {
                    const $element = $(element)

                    let chapterLink = ''
                    let chapterTitle = ''
                    let chapterNumber = ''
                    let chapterDate = ''

                    if ((element as any).tagName === 'a') {
                      chapterLink = $element.attr('href') || ''
                      chapterTitle = $element.text().trim()
                    } else {
                      const linkElement = $element.find('a').first()
                      chapterLink = linkElement.attr('href') || ''
                      chapterTitle = linkElement.text().trim() || $element.text().trim()
                    }

                    // Try to extract chapter number from title or URL
                    const numberMatches =
                      chapterTitle.match(
                        /(?:cap[ítulo]*\.?\s*|chapter\s*|ch\.?\s*)(\d+(?:\.\d+)?)/i
                      ) || chapterLink.match(/(?:chapter|cap|capitulo)[-_]?(\d+(?:\.\d+)?)/i)

                    if (numberMatches) {
                      chapterNumber = numberMatches[1]
                    } else {
                      // Fallback: use index as chapter number
                      chapterNumber = String(chapterElements.length - index)
                    }

                    // Try to extract date
                    const dateElement = $element.find('.chapter-date, .date, .release-date').first()
                    if (dateElement.length > 0) {
                      chapterDate = dateElement.text().trim()
                    }

                    // Extract chapter ID from URL
                    const chapterSiteId = this.extractIdFromUrl(chapterLink)

                    if (!chapterLink || !chapterNumber) return null

                    return {
                      siteId: chapterSiteId,
                      siteLink: siteId,
                      number: chapterNumber,
                      name: chapterTitle || `Chapter ${chapterNumber}`,
                      date: chapterDate || null,
                      repo: this.RepoTag
                    } as IChapter
                  })
                  .filter((chapter): chapter is IChapter => chapter !== null)
                  .sort((a, b) => parseFloat(b.number) - parseFloat(a.number)) // Sort by chapter number descending

                if (chapters.length > 0) return chapters
              }
            }
          } catch (error) {
            // Continue to next URL pattern
            continue
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
        // The siteLink should be the chapter URL path
        // Try to access the chapter page directly or construct possible URLs
        const chapterUrlPatterns = [
          siteLink.startsWith('/') ? siteLink : `/${siteLink}`,
          `/chapter/${siteLink}`,
          `/capitulo/${siteLink}`,
          `/read/${siteLink}`,
          `/manga/${siteLink}`
        ]

        for (const chapterUrl of chapterUrlPatterns) {
          try {
            const html = await this.makeRequest(chapterUrl)
            const $ = cheerio.load(html)

            // Try to find manga page images
            const imageSelectors = [
              '.reading-content img',
              '.chapter-content img',
              '.page-chapter img',
              '.reader-content img',
              '.manga-reader img',
              '#readerarea img',
              '.entry-content img',
              '.post-content img',
              'img[src*="manga"]',
              'img[src*="chapter"]',
              'img[data-src*="manga"]',
              'img[data-src*="chapter"]'
            ]

            let pages: IPage[] = []

            for (const selector of imageSelectors) {
              const imageElements = $(selector).toArray()

              if (imageElements.length > 0) {
                pages = imageElements
                  .map((element, index) => {
                    const $element = $(element)

                    let imageSrc =
                      $element.attr('src') ||
                      $element.attr('data-src') ||
                      $element.attr('data-lazy-src') ||
                      $element.attr('data-original') ||
                      ''

                    if (!imageSrc) return null

                    // Make sure URL is absolute
                    if (imageSrc.startsWith('//')) {
                      imageSrc = 'https:' + imageSrc
                    } else if (imageSrc.startsWith('/')) {
                      imageSrc = this.RepoUrl.replace(/\/$/, '') + imageSrc
                    } else if (!imageSrc.startsWith('http')) {
                      imageSrc = this.RepoUrl.replace(/\/$/, '') + '/' + imageSrc
                    }

                    // Extract filename from URL
                    const filename = imageSrc.split('/').pop() || `page-${index + 1}.jpg`

                    return {
                      path: imageSrc,
                      filename: filename
                    } as IPage
                  })
                  .filter((page): page is IPage => page !== null)
                  .filter((page) => {
                    // Filter out non-manga images (ads, UI elements, etc.)
                    const url = page.path.toLowerCase()
                    return (
                      !url.includes('logo') &&
                      !url.includes('banner') &&
                      !url.includes('advertisement') &&
                      !url.includes('ads') &&
                      (url.includes('jpg') ||
                        url.includes('jpeg') ||
                        url.includes('png') ||
                        url.includes('webp'))
                    )
                  })

                if (pages.length > 0) return pages
              }
            }
          } catch (error) {
            // Continue to next URL pattern
            continue
          }
        }

        return []
      } catch (error) {
        console.error('Error in getPages:', error)
        return []
      }
    }
  }
}

export default SakuraMangaRepoPlugin
