$f='F:\2609workspace\myblog\frontend\src\pages\blog\project.vue'
$c=Get-Content $f -Raw -Encoding utf8
$old='<view class="gh-link" @click="goBack">← 返回</view>'
$new='<GhIcon name="arrowLeft" :size="18" color="#2d6a4f" class="back-icon" @click="goBack" />'
$c=$c.Replace($old,$new)
Set-Content $f -Value $c -Encoding utf8 -NoNewline
Write-Host "done"
