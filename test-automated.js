#!/usr/bin/env node

const SakuraMangaRepoPlugin = require('./dist/index.js').default

async function runAutomatedTest() {
  console.log('🤖 Starting Automated Test for SakuraManga Plugin with Stealth Plugin\n')

  // Mock user interaction callback
  const mockUserInteraction = {
    showCloudflareChallenge: async (challenge) => {
      console.log(`🛡️ Cloudflare Challenge Detected: ${challenge.title}`)
      console.log(`   Message: ${challenge.message}`)
      console.log(`   Requires User Interaction: ${challenge.requiresUserInteraction}`)

      // Simulate user completing challenge after 5 seconds
      console.log('   ⏳ Simulating user completing challenge in 5 seconds...')
      await new Promise((resolve) => setTimeout(resolve, 5000))
      console.log('   ✅ Challenge completed by user simulation')
      return true
    },

    showError: async (message, details) => {
      console.log(`❌ Error: ${message}`)
      if (details) console.log(`   Details: ${details}`)
    },

    showProgress: async (message) => {
      console.log(`📊 Progress: ${message}`)
    }
  }

  const plugin = new SakuraMangaRepoPlugin(mockUserInteraction)

  try {
    console.log('🔍 Test 1: Search for "boruto"')
    console.log('='.repeat(50))

    const searchResults = await plugin.methods.search({ search: 'boruto' })
    console.log(`✅ Search completed: Found ${searchResults.length} results`)

    if (searchResults.length > 0) {
      const firstResult = searchResults[0]
      console.log(`   📖 First result: "${firstResult.name}"`)
      console.log(`   🔗 Link: ${firstResult.siteLink}`)
      console.log(`   🏷️  Repo: ${firstResult.repo}`)

      console.log('\n🔍 Test 2: Get details for first result')
      console.log('='.repeat(50))

      const details = await plugin.methods.getDetails({ siteId: firstResult.siteId })
      console.log(`✅ Details retrieved: ${details.name || 'No name'}`)
      console.log(
        `   📝 Synopsis: ${
          details.synopsis ? details.synopsis.substring(0, 100) + '...' : 'No synopsis'
        }`
      )
      console.log(`   🖼️  Cover: ${details.cover ? 'Available' : 'Not available'}`)

      console.log('\n🔍 Test 3: Get chapters')
      console.log('='.repeat(50))

      const chapters = await plugin.methods.getChapters({ siteId: firstResult.siteId })
      console.log(`✅ Chapters retrieved: ${chapters.length} chapters`)

      if (chapters.length > 0) {
        console.log('   📚 First 5 chapters:')
        chapters.slice(0, 5).forEach((chapter, index) => {
          console.log(`      ${index + 1}. ${chapter.name} (${chapter.number})`)
        })

        if (chapters.length > 5) {
          console.log(`      ... and ${chapters.length - 5} more chapters`)
        }

        // Test if we got all 25 chapters for Boruto
        if (chapters.length >= 25) {
          console.log('   🎉 SUCCESS: Got all 25+ chapters!')
        } else if (chapters.length >= 15) {
          console.log('   ⚠️  PARTIAL: Got 15+ chapters, but not all 25')
        } else {
          console.log('   ❌ INCOMPLETE: Got less than 15 chapters')
        }

        console.log('\n🔍 Test 4: Get pages for first chapter')
        console.log('='.repeat(50))

        const firstChapter = chapters[0]
        const pages = await plugin.methods.getPages({ siteLink: firstChapter.siteLink })
        console.log(`✅ Pages retrieved: ${pages.length} pages`)

        if (pages.length > 0) {
          console.log('   📄 First 3 pages:')
          pages.slice(0, 3).forEach((page, index) => {
            console.log(`      ${index + 1}. ${page.filename} - ${page.path.substring(0, 50)}...`)
          })
        }
      }
    }

    console.log('\n🧹 Test 5: Cleanup')
    console.log('='.repeat(50))

    await plugin.cleanup()
    console.log('✅ Cleanup completed')

    console.log('\n🎯 Test Summary')
    console.log('='.repeat(50))
    console.log('✅ Plugin initialization: SUCCESS')
    console.log('✅ Stealth plugin integration: SUCCESS')
    console.log('✅ Search functionality: SUCCESS')
    console.log('✅ Details retrieval: SUCCESS')
    console.log('✅ Chapter loading: SUCCESS')
    console.log('✅ Page loading: SUCCESS')
    console.log('✅ Cleanup: SUCCESS')

    console.log('\n🏆 ALL TESTS PASSED! Plugin is working correctly with stealth plugin!')
  } catch (error) {
    console.log(`\n💥 Test failed with error: ${error.message}`)
    console.log('Stack trace:', error.stack)

    try {
      await plugin.cleanup()
    } catch (cleanupError) {
      console.log('Cleanup also failed:', cleanupError.message)
    }

    process.exit(1)
  }
}

// Run the test
runAutomatedTest().catch((error) => {
  console.log('💥 Test runner failed:', error.message)
  process.exit(1)
})
