$Root            = Split-Path -Parent $MyInvocation.MyCommand.Path
$XamppMysqlStart = 'C:\xampp\mysql_start.bat'
$XamppMysqlExe   = 'C:\xampp\mysql\bin\mysql.exe'
$HealthUrl       = 'http://localhost:5001/api/health'

Write-Host "============================"
Write-Host "   Starting POS System"
Write-Host "============================"
Write-Host ""

# --- Read DB host/port/credentials from server\.env so the readiness check
#     connects to the exact same place the app itself will connect to.
#     Defaults match server/db/connection.js's own fallbacks. ---
$DbHost     = 'localhost'
$DbPort     = '3307'
$DbUser     = 'root'
$DbPassword = ''
$envPath = Join-Path $Root 'server\.env'
if (Test-Path $envPath) {
    foreach ($line in Get-Content $envPath) {
        if ($line -match '^\s*DB_HOST\s*=\s*(.*)$')      { $DbHost = $Matches[1].Trim() }
        if ($line -match '^\s*DB_PORT\s*=\s*(.*)$')      { $DbPort = $Matches[1].Trim() }
        if ($line -match '^\s*DB_USER\s*=\s*(.*)$')      { $DbUser = $Matches[1].Trim() }
        if ($line -match '^\s*DB_PASSWORD\s*=\s*(.*)$')  { $DbPassword = $Matches[1].Trim() }
    }
}

# Deliberately does NOT check `Get-Process -Name mysqld` — that matches ANY
# mysqld.exe on the machine, including an unrelated MySQL installation (e.g.
# a separately-installed "MySQL80" Windows service defaulting to port 3306).
# That ambiguity is exactly what let this script report "MySQL is already
# running" while talking to the wrong server entirely. The only thing that
# actually matters is: can the app's configured host/port/credentials reach
# a real MySQL server right now — so that's the only thing this checks.
# --protocol=TCP forces a real network connection to $DbHost:$DbPort rather
# than a local named pipe, which is what a bare `mysql -u root` can silently
# fall back to on Windows and would defeat the whole point of this check.
function Test-MysqlConnection {
    if (-not (Test-Path $XamppMysqlExe)) { return $false }
    $mysqlArgs = @('-h', $DbHost, "--port=$DbPort", '--protocol=TCP', '-u', $DbUser)
    if ($DbPassword -ne '') { $mysqlArgs += "-p$DbPassword" }
    $mysqlArgs += @('-e', 'SELECT 1;')
    $null | & $XamppMysqlExe @mysqlArgs *> $null
    return ($LASTEXITCODE -eq 0)
}

function Test-ServerHealthy {
    try {
        $resp = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        return ($resp.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Test-PortInUse($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Pause-ForUser {
    Write-Host "Press Enter to continue..."
    Read-Host | Out-Null
}

# ============================================================
# 1. MySQL - the only thing that matters is whether $DbHost:$DbPort is
#    actually reachable with the app's own credentials (see the comment
#    above Test-MysqlConnection for why process-name checks aren't used)
# ============================================================
if (Test-MysqlConnection) {
    Write-Host "MySQL is already running and reachable on ${DbHost}:${DbPort}."
}
elseif (Test-PortInUse $DbPort) {
    Write-Host "  WARNING: port $DbPort is in use, but the app's configured credentials"
    Write-Host "  (DB_USER/DB_PASSWORD in server\.env) could not connect to it."
    Write-Host "  Check those credentials, or whether a different MySQL server is bound"
    Write-Host "  to that port."
    Pause-ForUser
}
elseif (-not (Test-Path $XamppMysqlStart)) {
    Write-Host "  Could not find $XamppMysqlStart"
    Write-Host "  Please start MySQL manually from the XAMPP Control Panel, then press Enter."
    Pause-ForUser
}
else {
    Write-Host "Starting MySQL..."
    Start-Process -FilePath $XamppMysqlStart -WindowStyle Minimized

    $tries = 0
    $ready = $false
    while ($tries -lt 15 -and -not $ready) {
        Start-Sleep -Seconds 1
        $ready = Test-MysqlConnection
        $tries++
    }
    if (-not $ready) {
        Write-Host "  WARNING: MySQL did not respond on ${DbHost}:${DbPort} within 15 seconds."
        Write-Host "  Check the XAMPP Control Panel."
        Pause-ForUser
    } else {
        Write-Host "MySQL is now running and reachable on ${DbHost}:${DbPort}."
    }
}

# ============================================================
# 2. Build the frontend the first time (or after it's been deleted)
# ============================================================
$distIndex = Join-Path $Root 'client\dist\index.html'
if (-not (Test-Path $distIndex)) {
    Write-Host ""
    Write-Host "Building the app for the first time - this can take a minute..."
    Push-Location (Join-Path $Root 'client')
    npm install --silent
    npm run build
    Pop-Location
}

# ============================================================
# 3. Backend - confirm /api/health actually responds, not just
#    that something is listening on port 5001
# ============================================================
if (Test-ServerHealthy) {
    Write-Host ""
    Write-Host "POS server is already running."
}
elseif (Test-PortInUse 5001) {
    Write-Host "  WARNING: port 5001 is in use, but it is not responding to health checks."
    Write-Host "  Another program may be using that port, or the POS server may be stuck - close it and re-run this script."
    Pause-ForUser
}
else {
    Write-Host ""
    Write-Host "Starting POS server..."
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'node index.js' -WorkingDirectory (Join-Path $Root 'server') -WindowStyle Minimized

    $tries = 0
    $ready = $false
    while ($tries -lt 15 -and -not $ready) {
        Start-Sleep -Seconds 1
        $ready = Test-ServerHealthy
        $tries++
    }
    if (-not $ready) {
        Write-Host "  WARNING: POS server did not respond to health checks within 15 seconds."
        Pause-ForUser
    }
}

# ============================================================
# 4. Open the app
# ============================================================
Start-Process 'http://localhost:5001'

Write-Host ""
Write-Host "POS System is running. You can close this window."
Start-Sleep -Seconds 5
