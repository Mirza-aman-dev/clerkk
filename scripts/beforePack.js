const { execFileSync } = require('child_process')
const path = require('path')

const ARCH_NAMES = {
  0: 'ia32',
  1: 'x64',
  2: 'armv7l',
  3: 'arm64',
  4: 'universal'
}

exports.default = async function beforePack(context) {
  const platform = context.electronPlatformName // 'win32' | 'darwin' | 'linux'
  const arch = ARCH_NAMES[context.arch] || 'x64'
  const electronVersion = context.packager.info.framework.version || '33.4.11'
  const sqliteDir = path.join(context.packager.projectDir, 'node_modules', 'better-sqlite3')
  const prebuildBin = path.join(
    context.packager.projectDir,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prebuild-install.cmd' : 'prebuild-install'
  )

  console.log(
    `  • [beforePack] Fetching prebuilt better-sqlite3 for platform=${platform} arch=${arch} electron=${electronVersion}`
  )

  execFileSync(
    prebuildBin,
    [
      `--platform=${platform}`,
      `--arch=${arch}`,
      '--runtime=electron',
      `--target=${electronVersion}`
    ],
    {
      cwd: sqliteDir,
      stdio: 'inherit'
    }
  )
}
