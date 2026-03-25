/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
| SRS: All feature routes are imported here.
| Pattern: import '#features/{name}/routes.js' for each feature added.
|
*/

import router from '@adonisjs/core/services/router'

// Health check endpoint
router.get('/', async () => {
  return { hello: 'world' }
})
