const { execSync } = require('child_process')
const path = require('path')

const composeFile = path.join(__dirname, '..', 'docker-compose.test.yml')

module.exports = async function globalTeardown() {
  execSync(`docker compose -f "${composeFile}" down -v`, { stdio: 'inherit' })
}
