import { access, chmod, mkdir } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(projectRoot, 'resources', 'bin')
const FORCE = process.argv.includes('--force')

const RELEASE_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest'
const DOWNLOAD_BASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'

const ASSETS = {
  win32: { x64: 'yt-dlp.exe', arm64: 'yt-dlp_arm64.exe', ia32: 'yt-dlp_x86.exe' },
  darwin: { x64: 'yt-dlp_macos', arm64: 'yt-dlp_macos' },
  linux: { x64: 'yt-dlp_linux', arm64: 'yt-dlp_linux_aarch64' }
}

const TARGET_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'

function resolveAsset(platform, arch) {
  const byPlatform = ASSETS[platform]
  if (!byPlatform) {
    throw new Error(`Unsupported platform: ${platform}`)
  }
  const asset = byPlatform[arch]
  if (!asset) {
    throw new Error(`Unsupported architecture "${arch}" for platform "${platform}".`)
  }
  return asset
}

async function fetchLatestVersion() {
  const response = await fetch(RELEASE_URL, {
    headers: { 'User-Agent': 'EasyDownload/0.1.0' }
  })
  if (!response.ok) {
    throw new Error(`Failed to resolve the latest yt-dlp release: HTTP ${response.status}`)
  }
  const release = await response.json()
  return release.tag_name ?? 'latest'
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EasyDownload/0.1.0' }
  })
  if (!response.ok) {
    throw new Error(`Download failed (HTTP ${response.status}): ${url}`)
  }
  await pipeline(response.body, createWriteStream(destination))
}

async function main() {
  const asset = resolveAsset(process.platform, process.arch)
  const target = join(outputDir, TARGET_NAME)

  if (!FORCE) {
    try {
      await access(target)
      console.log(`yt-dlp already present at ${target}; skipping download (use --force to redownload).`)
      return
    } catch {
      // Binary not present; proceed with download.
    }
  }

  const version = await fetchLatestVersion()

  await mkdir(outputDir, { recursive: true })
  console.log(`Downloading ${asset} (${version}) to ${target}`)
  await download(`${DOWNLOAD_BASE}/${asset}`, target)
  if (process.platform !== 'win32') {
    await chmod(target, 0o755)
  }
  console.log('yt-dlp downloaded successfully.')
}

main().catch((err) => {
  console.error(`Failed to download yt-dlp: ${err.message}`)
  process.exit(1)
})
