const { execSync } = require('child_process')
const path = require('path')

const composeFile = path.join(__dirname, '..', 'docker-compose.test.yml')

module.exports = async function globalSetup() {
  execSync(`docker compose -f "${composeFile}" up -d --wait`, { stdio: 'inherit' })
}
