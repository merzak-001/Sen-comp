try {
    $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
    Write-Output "Word COM connected! Total open docs: $($word.Documents.Count)"
    foreach ($d in $word.Documents) {
        Write-Output "Document name: $($d.Name)"
        if ($d.Name -like "*SEP*") {
            Write-Output "Total tables in $($d.Name): $($d.Tables.Count)"
            # Let's inspect the last table
            $lastTable = $d.Tables.Item($d.Tables.Count)
            Write-Output "Last Table rows: $($lastTable.Rows.Count), cols: $($lastTable.Columns.Count)"
            for ($r = 1; $r -le $lastTable.Rows.Count; $r++) {
                $rowText = @()
                for ($c = 1; $c -le $lastTable.Columns.Count; $c++) {
                    try {
                        $cellText = $lastTable.Cell($r, $c).Range.Text.Trim("`r`n`a ")
                        $rowText += $cellText
                    } catch {
                        $rowText += ""
                    }
                }
                Write-Output ($rowText -join " | ")
            }

            # Also let's check table count - 1 if there's another table
            if ($d.Tables.Count -ge 2) {
                Write-Output "`n--- Table before last ($($d.Tables.Count - 1)) ---"
                $t = $d.Tables.Item($d.Tables.Count - 1)
                for ($r = 1; $r -le [Math]::Min(15, $t.Rows.Count); $r++) {
                    $rowText = @()
                    for ($c = 1; $c -le $t.Columns.Count; $c++) {
                        try {
                            $cellText = $t.Cell($r, $c).Range.Text.Trim("`r`n`a ")
                            $rowText += $cellText
                        } catch {
                            $rowText += ""
                        }
                    }
                    Write-Output ($rowText -join " | ")
                }
            }
        }
    }
} catch {
    Write-Output "Error with Word COM: $_"
}
