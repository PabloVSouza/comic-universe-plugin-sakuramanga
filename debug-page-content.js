#!/usr/bin/env node

// Debug test to see what's actually on the Boruto page
const SakuraMangaRepoPlugin = require('./dist/index.js').default

async function debugPageContent() {
  console.log('🔍 Debugging page content after Cloudflare bypass...\n')

  const plugin = new SakuraMangaRepoPlugin()

  try {
    // Initialize and establish session
    await plugin.initBrowser()
    await plugin.establishSession()

    console.log('✅ Session established, navigating to Boruto page...')

    // Navigate to Boruto page
    await plugin.page.goto('https://sakuramangas.org/obras/boruto-two-blue-vortex/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })

    console.log('✅ Page loaded, analyzing content...\n')

    // Extract detailed page information
    const pageInfo = await plugin.page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        bodyLength: document.body.textContent.length,
        bodyPreview: document.body.textContent.substring(0, 500),

        // Check for various chapter-related elements
        hasCapituloLista: !!document.querySelector('.capitulo-lista'),
        hasCapituloItem: !!document.querySelector('.capitulo-item'),
        hasChapters: !!document.querySelector('.chapters'),
        hasChapterList: !!document.querySelector('.chapter-list'),

        // Get all elements that might be chapter containers
        possibleContainers: [
          '.capitulo-lista',
          '.capitulo-item',
          '.lista-capitulos',
          '.chapters',
          '.chapter-list',
          '.manga-chapters',
          '.chapter-container',
          '[class*="capitulo"]',
          '[class*="chapter"]'
        ]
          .map((selector) => {
            const elements = document.querySelectorAll(selector)
            return {
              selector,
              count: elements.length,
              hasContent:
                elements.length > 0 && Array.from(elements).some((el) => el.textContent?.trim())
            }
          })
          .filter((item) => item.count > 0),

        // Get all script tags that might load chapters
        scripts: Array.from(document.querySelectorAll('script[src]'))
          .map((s) => s.src)
          .filter((src) => src.includes('manga') || src.includes('capitulo')),

        // Get all classes that contain 'capitulo' or 'chapter'
        relevantClasses: Array.from(document.querySelectorAll('*'))
          .map((el) => el.className)
          .filter(
            (className) =>
              typeof className === 'string' &&
              (className.includes('capitulo') || className.includes('chapter'))
          )
          .slice(0, 20), // Limit to first 20

        // Check if there are any loading indicators
        loadingIndicators: ['.loading', '.spinner', '[class*="load"]', '[class*="spinner"]']
          .map((selector) => ({
            selector,
            count: document.querySelectorAll(selector).length
          }))
          .filter((item) => item.count > 0)
      }
    })

    console.log('📊 Page Analysis Results:')
    console.log(`   Title: "${pageInfo.title}"`)
    console.log(`   URL: ${pageInfo.url}`)
    console.log(`   Body length: ${pageInfo.bodyLength} characters`)
    console.log(`   Body preview: ${pageInfo.bodyPreview}\n`)

    console.log('🔍 Chapter Element Check:')
    console.log(`   .capitulo-lista: ${pageInfo.hasCapituloLista ? '✅' : '❌'}`)
    console.log(`   .capitulo-item: ${pageInfo.hasCapituloItem ? '✅' : '❌'}`)
    console.log(`   .chapters: ${pageInfo.hasChapters ? '✅' : '❌'}`)
    console.log(`   .chapter-list: ${pageInfo.hasChapterList ? '✅' : '❌'}\n`)

    if (pageInfo.possibleContainers.length > 0) {
      console.log('📦 Found possible chapter containers:')
      pageInfo.possibleContainers.forEach((container) => {
        console.log(
          `   ${container.selector}: ${container.count} elements, has content: ${container.hasContent}`
        )
      })
    } else {
      console.log('❌ No chapter containers found')
    }

    if (pageInfo.scripts.length > 0) {
      console.log('\n📜 Relevant scripts:')
      pageInfo.scripts.forEach((script) => console.log(`   ${script}`))
    }

    if (pageInfo.relevantClasses.length > 0) {
      console.log('\n🏷️  Relevant classes:')
      pageInfo.relevantClasses.forEach((className) => console.log(`   ${className}`))
    }

    if (pageInfo.loadingIndicators.length > 0) {
      console.log('\n⏳ Loading indicators:')
      pageInfo.loadingIndicators.forEach((indicator) =>
        console.log(`   ${indicator.selector}: ${indicator.count} elements`)
      )
    }

    // Wait a bit and check again for dynamic content
    console.log('\n⏳ Waiting 30 seconds for dynamic content...')
    await new Promise((resolve) => setTimeout(resolve, 30000))

    const afterWaitInfo = await plugin.page.evaluate(() => {
      const capituloLista = document.querySelector('.capitulo-lista')
      return {
        hasCapituloLista: !!capituloLista,
        capituloListaHtml: capituloLista ? capituloLista.innerHTML.substring(0, 500) : 'Not found',
        chapterItemCount: document.querySelectorAll('.capitulo-item').length
      }
    })

    console.log('🔄 After 30s wait:')
    console.log(`   .capitulo-lista: ${afterWaitInfo.hasCapituloLista ? '✅' : '❌'}`)
    console.log(`   .capitulo-item count: ${afterWaitInfo.chapterItemCount}`)
    console.log(`   HTML preview: ${afterWaitInfo.capituloListaHtml}`)

    await plugin.browser.close()
  } catch (error) {
    console.log('💥 Error:', error.message)
    if (plugin.browser) {
      await plugin.browser.close()
    }
  }
}

debugPageContent()
