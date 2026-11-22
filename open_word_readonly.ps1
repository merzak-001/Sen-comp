$file = (Get-ChildItem -Path "C:\Users\msai\OneDrive - Sensus Germany GmbH & Co. KG\Documents\OS-appro" -Filter "*SEP*.docx").FullName
Write-Output "Opening file: $file"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($file, $false, $true) # ReadOnly
    Write-Output "Opened successfully!"
    Write-Output "Document Paragraphs Count: $($doc.Paragraphs.Count)"
    Write-Output "Document Tables Count: $($doc.Tables.Count)"

    # Print paragraphs near the end
    Write-Output "`n=== LAST 30 PARAGRAPHS ==="
    $startP = [Math]::Max(1, $doc.Paragraphs.Count - 35)
    for ($i = $startP; $i -le $doc.Paragraphs.Count; $i++) {
        $pText = $doc.Paragraphs.Item($i).Range.Text.Trim("`r`n`a ")
        if ($pText.Length -gt 0) {
            Write-Output "P ${i}: $pText"
        }
    }

    # Print all tables
    for ($i = 1; $i -le $doc.Tables.Count; $i++) {
        $t = $doc.Tables.Item($i)
        Write-Output "`n================ TABLE $i (Rows: $($t.Rows.Count), Cols: $($t.Columns.Count)) ================"
        for ($r = 1; $r -le $t.Rows.Count; $r++) {
            $row = @()
            for ($c = 1; $c -le $t.Columns.Count; $c++) {
                try {
                    $row += $t.Cell($r, $c).Range.Text.Trim("`r`n`a ")
                } catch {
                    $row += ""
                }
            }
            Write-Output ($row -join " | ")
        }
    }

    $doc.Close([ref]$false)
} finally {
    $word.Quit()
}
