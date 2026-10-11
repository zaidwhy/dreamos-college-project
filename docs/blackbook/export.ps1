# Opens the report in Word and exports the PDF. Paste/run these lines in the PowerShell tool
# itself: launched as a child 'powershell -File' on this machine, the Word COM call hangs.
# A stale '~$*.docx' lock file next to the report also stalls it; delete that first. With -Toc it also refreshes the TOC field and
# saves the .docx (seconds once alerts are off; do it after the page numbers have stabilised).
param([switch]$Toc)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$docx = Join-Path $dir "DreamOS-Final-Year-Project-Report.docx"
$pdf  = Join-Path $dir "DreamOS-Final-Year-Project-Report.pdf"
$w = New-Object -ComObject Word.Application
$w.Visible = $true
$w.DisplayAlerts = 0   # a modal prompt (field update) otherwise hangs the COM call
$d = $w.Documents.Open($docx)
if ($Toc) { $d.TablesOfContents.Item(1).Update() }
$d.SaveAs2($pdf, 17)
"pages: " + $d.ComputeStatistics(2)
if ($Toc) { $d.Save() }
$d.Close([bool]$Toc)
$w.Quit()
