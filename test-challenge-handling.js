#!/usr/bin/env node

const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')

// Add stealth plugin
puppeteer.use(StealthPlugin())

async function testChallengeHandling() {
  console.log('🛡️ Testing Cloudflare Challenge Handling\n')
  console.log('This test will show the browser and wait for you to complete the challenge manually')
  console.log(
    'The challenge should resolve automatically, but if it gets stuck, you can help it along\n'
  )

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see the challenge
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  })

  const page = await browser.newPage()

  try {
    console.log('🌐 Navigating to SakuraManga...')
    await page.goto('https://sakuramangas.org/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    console.log('⏳ Waiting for Cloudflare challenge to resolve...')
    console.log('   (You should see the browser window with the challenge)')
    console.log('   If it gets stuck at "verifying", try refreshing the page')

    // Wait longer and check multiple times
    let attempts = 0
    let maxAttempts = 20 // 2 minutes total

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 6000)) // Wait 6 seconds each time
      attempts++

      const title = await page.title()
      const cookies = await page.cookies()
      const url = page.url()

      console.log(
        `   Attempt ${attempts}/${maxAttempts}: Title="${title}", Cookies=${cookies.length}, URL=${url}`
      )

      // Check if we've passed the challenge
      if (title.includes('Sakura Mangás') || title.includes('Sakura Mangas')) {
        console.log('✅ SUCCESS: Cloudflare challenge completed!')
        break
      }

      // Check if we're still on the challenge page
      if (
        title.includes('Just a moment') ||
        title.includes('Um momento') ||
        title.includes('Verifying')
      ) {
        console.log('   🔄 Still on challenge page, waiting...')
        continue
      }

      // Check if we got redirected to a different page
      if (!url.includes('sakuramangas.org')) {
        console.log('   🔄 Got redirected, navigating back...')
        await page.goto('https://sakuramangas.org/', { waitUntil: 'domcontentloaded' })
        continue
      }

      // If we get here, something unexpected happened
      console.log('   ❓ Unexpected state, continuing to wait...')
    }

    // Final check
    const finalTitle = await page.title()
    const finalCookies = await page.cookies()

    console.log(`\n📊 Final Results:`)
    console.log(`   Title: "${finalTitle}"`)
    console.log(`   Cookies: ${finalCookies.length}`)
    console.log(`   URL: ${page.url()}`)

    if (finalTitle.includes('Sakura Mangás') || finalTitle.includes('Sakura Mangas')) {
      console.log('\n🎉 SUCCESS: Challenge resolved successfully!')

      // Test if we can access manga pages
      console.log('\n🔍 Testing manga page access...')
      await page.goto('https://sakuramangas.org/obras/boruto-two-blue-vortex/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const mangaTitle = await page.title()
      const hasVerMais = await page.evaluate(() => {
        const button = document.getElementById('ver-mais')
        return !!button
      })

      console.log(`📖 Manga page: "${mangaTitle}"`)
      console.log(`🔘 Ver-mais button: ${hasVerMais ? '✅' : '❌'}`)

      if (mangaTitle.includes('Boruto') && hasVerMais) {
        console.log('✅ PERFECT: Manga page loaded correctly!')
        console.log('   The plugin should work perfectly now!')
      } else {
        console.log('⚠️  Manga page may need additional challenge resolution')
      }
    } else {
      console.log('\n❌ Challenge did not resolve automatically')
      console.log('   This is normal - some Cloudflare challenges require manual intervention')
      console.log('   The plugin will handle this by showing the challenge UI to the user')
    }

    console.log('\n⏳ Keeping browser open for 15 seconds so you can see the results...')
    await new Promise((resolve) => setTimeout(resolve, 15000))
  } catch (error) {
    console.log(`💥 Test error: ${error.message}`)
  } finally {
    await browser.close()
  }
}

// Run the test
testChallengeHandling().catch((error) => {
  console.log('💥 Test runner failed:', error.message)
  process.exit(1)
})
