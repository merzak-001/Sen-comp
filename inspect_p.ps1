$file = (Get-ChildItem -Path "C:\Users\msai\OneDrive - Sensus Germany GmbH & Co. KG\Documents\OS-appro" -Filter "*SEP*.docx").FullName

$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {
    $doc = $word.Documents.Open($file, $false, $true)
    for ($i = 150; $i -le 225; $i++) {
        $t = $doc.Paragraphs.Item($i).Range.Text.Trim("`r`n`a ")
        if ($t.Length -gt 0) {
            Write-Output "P ${i}: $t"
        }
    }
    $doc.Close([ref]$false)
} finally {
    $word.Quit()
}
