# Installs the Marker Export CEP panel into Premiere Pro on Windows.
# Enables loading of the unsigned panel, then copies it into the
# CEP extensions folder. Re-running is safe (idempotent).
# Run in PowerShell:  ./install.ps1
$ErrorActionPreference = "Stop"

$Panel  = "com.texs.markerexport"
$Src    = Join-Path $PSScriptRoot $Panel
$ExtDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"

if (-not (Test-Path $Src)) {
    Write-Error "Cannot find $Panel next to this script ($Src)."
}

Write-Host "Enabling unsigned CEP extensions (PlayerDebugMode)..."
# Cover CEP 9-13 so it works across Premiere 2019 -> 2026+.
foreach ($v in 9..13) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    New-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
}

Write-Host "Installing panel into:"
Write-Host "  $ExtDir\$Panel"
$Dest = Join-Path $ExtDir $Panel
if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
New-Item -ItemType Directory -Path $ExtDir -Force | Out-Null
Copy-Item -Path $Src -Destination $Dest -Recurse -Force

Write-Host ""
Write-Host "Done. Now FULLY QUIT Premiere Pro and reopen it, then:"
Write-Host "  Window -> Extensions -> Marker Export"
