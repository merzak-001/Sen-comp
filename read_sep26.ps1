Add-Type -AssemblyName System.IO.Compression.FileSystem

$docx = Get-ChildItem -Path "C:\Users\msai\OneDrive - Sensus Germany GmbH & Co. KG\Documents\OS-appro" -Filter "*SEP*.docx" | Select-Object -First 1 -ExpandProperty FullName
Write-Output "Original: $docx"

# Copy using FileShare.ReadWrite to temp file
$tempDocx = [System.IO.Path]::GetTempFileName() + ".docx"
$inStream = New-Object System.IO.FileStream($docx, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$outStream = New-Object System.IO.FileStream($tempDocx, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$inStream.CopyTo($outStream)
$inStream.Close()
$outStream.Close()

Write-Output "Copied to temp: $tempDocx"

$zip = [System.IO.Compression.ZipFile]::OpenRead($tempDocx)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()
Remove-Item $tempDocx -Force

$xml = [xml]$content
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

Write-Output "================ ALL PARAGRAPHS ================"
$nodes = $xml.SelectNodes("//w:p", $ns)
foreach ($p in $nodes) {
    $tNodes = $p.SelectNodes(".//w:t", $ns)
    $text = ($tNodes | ForEach-Object { $_.InnerText }) -join ""
    if ($text.Trim().Length -gt 0) {
        Write-Output $text
    }
}

Write-Output "`n================ ALL TABLES ================"
$tables = $xml.SelectNodes("//w:tbl", $ns)
$idx = 1
foreach ($tbl in $tables) {
    Write-Output "`n--- TABLE $idx ---"
    $rows = $tbl.SelectNodes(".//w:tr", $ns)
    foreach ($r in $rows) {
        $cells = $r.SelectNodes(".//w:tc", $ns)
        $cellTexts = foreach ($c in $cells) {
            $t = ($c.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join " "
            $t.Trim()
        }
        Write-Output ($cellTexts -join " | ")
    }
    $idx++
}
