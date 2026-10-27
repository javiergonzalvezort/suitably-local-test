# Installer for Windows 10/11 (Windows PowerShell 5.1 or PowerShell 7).
#
# One line, from any folder:
#   irm https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.ps1 | iex
# Or from the project folder:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#
# What it does: installs Git, Node.js LTS, and Typst with winget if they are missing,
# downloads the project (unless you run it from inside the project), turns on the
# privacy check for commits, creates your private me/ folder, and runs the doctor.
#
# Options, as environment variables set before running:
#   $env:INSTALL_DIR = "C:\path"   where to download the project (default: your home folder)
#   $env:DRY_RUN = "1"             show what would be installed, change nothing

$ErrorActionPreference = 'Stop'

$AppName = 'suitably-local-test'
$RepoUrl = 'https://github.com/javiergonzalvezort/suitably-local-test.git'
$MinNode = [version]'22.18.0'
$DryRun = $env:DRY_RUN -eq '1'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }

function Test-Command([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# New programs add themselves to PATH in the registry; reload it so this
# window can use them without being reopened.
function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Install-Package([string]$Id, [string]$Label) {
    if ($DryRun) {
        Write-Host "    (dry run) would run: winget install --id $Id -e"
        return
    }
    if (-not (Test-Command 'winget')) {
        throw "winget is not available. Install 'App Installer' from the Microsoft Store, then run this installer again."
    }
    Write-Host "    Installing $Label. Windows may ask for permission; please accept."
    winget install --id $Id -e --source winget --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) {
        throw "Could not install $Label (winget exit code $LASTEXITCODE). Try again, or install it by hand and rerun."
    }
    Update-SessionPath
}

function Get-NodeVersion {
    if (-not (Test-Command 'node')) { return $null }
    $text = (& node --version) -replace '^v', ''
    try { return [version]$text } catch { return $null }
}

Write-Host ""
Write-Host "$AppName installer" -ForegroundColor White
Write-Host ""

# 1. Git
Write-Step 'Git'
if (Test-Command 'git') { Write-Ok (& git --version) } else { Install-Package 'Git.Git' 'Git' }

# 2. Node.js
Write-Step 'Node.js'
$nodeVersion = Get-NodeVersion
if ($null -ne $nodeVersion -and $nodeVersion -ge $MinNode) {
    Write-Ok "Node.js $nodeVersion"
} else {
    if ($null -ne $nodeVersion) { Write-Host "    Node.js $nodeVersion is too old (need $MinNode or newer)." }
    Install-Package 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    $nodeVersion = Get-NodeVersion
    if (-not $DryRun -and ($null -eq $nodeVersion -or $nodeVersion -lt $MinNode)) {
        throw "Node.js $MinNode or newer is still not available. Close this window, open a new PowerShell, and run the installer again."
    }
}

# 3. Typst (turns CVs and cover letters into PDF)
Write-Step 'Typst'
if (Test-Command 'typst') { Write-Ok (& typst --version) } else { Install-Package 'Typst.Typst' 'Typst' }

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run finished. Nothing was changed."
    return
}

# 4. The project folder
Write-Step 'Project files'
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'AGENTS.md'))) {
    $ProjectDir = $PSScriptRoot
    Write-Ok "Using this folder: $ProjectDir"
} else {
    $base = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { $HOME }
    $ProjectDir = Join-Path $base $AppName
    if (Test-Path (Join-Path $ProjectDir '.git')) {
        Write-Ok "Updating $ProjectDir"
        git -C $ProjectDir pull --ff-only
    } else {
        Write-Ok "Downloading to $ProjectDir"
        git clone $RepoUrl $ProjectDir
    }
    if ($LASTEXITCODE -ne 0) { throw 'Could not download the project. Check your internet connection and try again.' }
}
Set-Location $ProjectDir

# 5. Privacy check for commits, and your private workspace
Write-Step 'Privacy check and your private folder'
git config core.hooksPath .githooks
node scripts/init-workspace.ts

# 6. Doctor
Write-Step 'Checking everything'
node scripts/doctor.ts --online

Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. See the sample first:   cd `"$ProjectDir`"; npm run demo"
Write-Host "  2. Open your agent here:   claude"
Write-Host "  3. Ask it:                 Set up my profile"
Write-Host ""
