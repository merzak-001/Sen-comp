Add-Type -AssemblyName System.IO.Compression.FileSystem
$docxPath = "Réalisation service approvisionnements SEP-26.docx"
$zip = [System.IO.Compression.ZipFile]::OpenRead($docxPath)
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()

# Extract paragraphs and tables
$xml = [xml]$content
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")

# Let's output all text
$nodes = $xml.SelectNodes("//w:p", $ns)
foreach ($p in $nodes) {
    $tNodes = $p.SelectNodes(".//w:t", $ns)
    $text = ($tNodes | ForEach-Object { $_.InnerText }) -join ""
    if ($text.Trim().Length -gt 0) {
        Write-Output $text
    }
}

Write-Output "--- TABLES ---"
$tables = $xml.SelectNodes("//w:tbl", $ns)
$tblIndex = 1
foreach ($tbl in $tables) {
    Write-Output "Table $tblIndex"
    $rows = $tbl.SelectNodes(".//w:tr", $ns)
    foreach ($r in $rows) {
        $cells = $r.SelectNodes(".//w:tc", $ns)
        $cellTexts = foreach ($c in $cells) {
            $t = ($c.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join " "
            $t.Trim()
        }
        Write-Output ($cellTexts -join " | ")
    }
    $tblIndex++
}
