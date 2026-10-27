$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$python = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$manage = Join-Path $projectRoot 'backend\manage.py'

if (-not (Test-Path -LiteralPath $python)) {
    throw 'Python environment not found. Create backend/.venv first.'
}

$gmailAddress = (Read-Host 'Gmail sender address').Trim()
if ($gmailAddress -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    throw 'Enter a valid email address.'
}
$appPassword = Read-Host 'Google app password (hidden)' -AsSecureString
if ($appPassword.Length -eq 0) {
    throw 'App password is required.'
}

$env:DJANGO_EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
$env:DJANGO_EMAIL_HOST = 'smtp.gmail.com'
$env:DJANGO_EMAIL_PORT = '587'
$env:DJANGO_EMAIL_USE_TLS = '1'
$env:DJANGO_EMAIL_USER = $gmailAddress
$env:DJANGO_FROM_EMAIL = $gmailAddress
$env:DJANGO_EMAIL_PASSWORD = [System.Net.NetworkCredential]::new('', $appPassword).Password
Remove-Variable appPassword

try {
    Write-Host 'Sending a test email to the Gmail sender address...'
    & $python $manage test_email
    if ($LASTEXITCODE -ne 0) { throw 'SMTP test failed. Django was not restarted.' }

    $listener = Get-NetTCPConnection -LocalPort 8011 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $running = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        $expectedPython = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
        if (-not $running -or -not $running.CommandLine.Contains($expectedPython) -or
            $running.CommandLine -notmatch 'manage\.py runserver 127\.0\.0\.1:8011') {
            throw 'Port 8011 is used by another process. Stop it before running this script.'
        }
        Stop-Process -Id $listener.OwningProcess
        Start-Sleep -Seconds 1
    }

    Write-Host 'SMTP test accepted. Starting Django on http://127.0.0.1:8011/'
    & $python -u $manage runserver 127.0.0.1:8011 --noreload
} finally {
    Remove-Item Env:DJANGO_EMAIL_PASSWORD -ErrorAction SilentlyContinue
}
