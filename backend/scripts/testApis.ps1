Write-Host "=== GET /transactions?page=1&limit=2 ===" -ForegroundColor Cyan
$r1 = Invoke-RestMethod "http://localhost:5000/transactions?page=1&limit=2&sortBy=newest"
Write-Host "Success: $($r1.success) | Total: $($r1.totalCount) | Pages: $($r1.totalPages)"
$r1.transactions | ForEach-Object { Write-Host "  $($_.transactionId) | $($_.status) | Rs.$($_.amount)" }

Write-Host ""
Write-Host "=== GET /transactions?status=success&limit=2 ===" -ForegroundColor Cyan
$r2 = Invoke-RestMethod "http://localhost:5000/transactions?page=1&limit=2&status=success"
Write-Host "Success: $($r2.success) | Total: $($r2.totalCount)"

Write-Host ""
Write-Host "=== GET /transactions/analytics ===" -ForegroundColor Cyan
$userId = $r1.transactions[0].userId
$r3 = Invoke-RestMethod "http://localhost:5000/transactions/analytics?userId=$userId"
Write-Host "Success: $($r3.success)"
$r3.analytics | Format-List

Write-Host "=== POST /payments/webhook (first call) ===" -ForegroundColor Cyan
$txnId = $r1.transactions[0].transactionId
$payload = @{
    eventId = "evt_idem_verify_01"
    type = "payment.succeeded"
    data = @{ transactionId = $txnId }
}
$r4 = Invoke-RestMethod -Method POST -Uri "http://localhost:5000/payments/webhook" -Body ($payload | ConvertTo-Json -Compress) -ContentType "application/json"
Write-Host "Success: $($r4.success) | Duplicate: $($r4.duplicate) | Status: $($r4.status)"

Write-Host ""
Write-Host "=== POST /payments/webhook (DUPLICATE call - same eventId) ===" -ForegroundColor Cyan
$r5 = Invoke-RestMethod -Method POST -Uri "http://localhost:5000/payments/webhook" -Body ($payload | ConvertTo-Json -Compress) -ContentType "application/json"
Write-Host "Success: $($r5.success) | Duplicate: $($r5.duplicate) | Status: $($r5.status)"
