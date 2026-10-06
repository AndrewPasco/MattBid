# Types the line numbers on the clipboard, one after another, into the box you click.
# The FedEx bid form moves to the next box by itself after 4 digits, so no Tab is sent.
param([int]$Delay = 5, [int]$KeyDelayMs = 150, [switch]$NoPause)
Add-Type -AssemblyName System.Windows.Forms
$lines = @((Get-Clipboard -Raw) -split '\s+' | Where-Object { $_ })
if (-not $lines -or ($lines | Where-Object { $_ -notmatch '^\d{4}$' })) {
  Write-Host 'The clipboard does not hold 4-digit line numbers. In MattBid, tap Export bid, then Copy.'
  if (-not $NoPause) { Read-Host 'Press Enter to close' }
  exit 1
}
Write-Host "$($lines.Count) lines on the clipboard. Click the FIRST box on the FedEx page now."
for ($i = $Delay; $i -gt 0; $i--) { Write-Host "Typing starts in $i..."; Start-Sleep 1 }
foreach ($n in $lines) { [System.Windows.Forms.SendKeys]::SendWait($n); Start-Sleep -Milliseconds $KeyDelayMs }
Write-Host 'Done. Check the first and last boxes before you submit.'
if (-not $NoPause) { Read-Host 'Press Enter to close' }
