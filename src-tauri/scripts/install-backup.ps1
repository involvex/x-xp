param(
	[Parameter(Mandatory = $true)]
	[string]$InstallDir
)

$ErrorActionPreference = 'Continue'
$backupRoot = 'HKLM:\Software\Involvex\x-xp\Backup'

function Ensure-Key($path) {
	if (-not (Test-Path $path)) {
		New-Item -Path $path -Force | Out-Null
	}
}

Ensure-Key $backupRoot

# System Restore point (best effort; may require admin + SR enabled)
try {
	Checkpoint-Computer -Description 'Before x-xp default explorer' -RestorePointType MODIFY_SETTINGS
	Set-ItemProperty -Path $backupRoot -Name 'RestorePointCreated' -Value '1' -Force
} catch {
	Set-ItemProperty -Path $backupRoot -Name 'RestorePointCreated' -Value '0' -Force
	Set-ItemProperty -Path $backupRoot -Name 'RestorePointError' -Value $_.Exception.Message -Force
}

# Backup classic open commands
$map = @{
	'DirectoryOpenCommand' = 'HKCR:\Directory\shell\open\command'
	'FolderOpenCommand'    = 'HKCR:\Folder\shell\open\command'
	'DriveOpenCommand'     = 'HKCR:\Drive\shell\open\command'
	'DirectoryShellDefault' = 'HKCR:\Directory\shell'
}

New-PSDrive -Name HKCR -PSProvider Registry -Root HKEY_CLASSES_ROOT -ErrorAction SilentlyContinue | Out-Null

foreach ($entry in $map.GetEnumerator()) {
	try {
		if (Test-Path $entry.Value) {
			$val = (Get-ItemProperty -Path $entry.Value -Name '(default)' -ErrorAction SilentlyContinue).'(default)'
			if ($null -ne $val) {
				Set-ItemProperty -Path $backupRoot -Name $entry.Key -Value $val -Force
			}
		}
	} catch {
		# ignore individual key failures
	}
}

Set-ItemProperty -Path $backupRoot -Name 'InstallDir' -Value $InstallDir -Force
Set-ItemProperty -Path $backupRoot -Name 'BackedUpAt' -Value (Get-Date -Format o) -Force
