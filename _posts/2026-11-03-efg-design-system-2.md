---
layout: post
title: "EFG 개발기: 정리, 정리, 정리... 디자인 시스템 2탄"
description: 1탄 이후 남은 세 가지 불만에서 시작해 팔레트를 네 단계로 줄이기까지, EFG 디자인 시스템 2탄.
---
[1탄](/posts/2026-10-27-efg-design-system-1/)을 마치고 남은 불만은 이랬다.

- 버튼 상태에 따라서 너무 ㄸ색으로 보이는데...
- 사이드바의 회색 배경에 노랑 강조색은 너무 안 보이는데...
- 브랜드 색상이 너무 미미한데..

## 1. 갈색을 빼고 노랑으로

켜짐, 선택, 진행, 포커스를 전부 진한 갈색이 맡고 있었다. 구분은 체크와 아이콘에 맡기고, 면은 노랑으로 돌렸다. 포커스 선도 한 단계 연하게.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-01-checkbox-toggle.png" alt="체크박스와 토글의 off·on 전후 비교. 전에는 켜짐이 진한 갈색, 후에는 연노랑 면에 진한 체크와 손잡이" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-2/ds2-02-button-states.png" alt="버튼 기본·hover·pressed·focus 전후 비교. 후에는 hover와 pressed가 노랑 계열로 진해지고 focus 선이 한 단계 연해짐" loading="lazy"></figure>
</div>

## 2. 답은 맨 처음 팔레트에

이번엔 버튼을 누르는 순간의 색이 문제였다. 1탄에서는 노랑 위에 갈색을 살짝 덮어 진하게 했는데, 그랬더니 노랑이 아니라 탁한 올리브색이 됐다. 그래서 더 진하고 쨍한 노랑(500)을 새로 만들었더니 혼자 튀었다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-03-pressed-journey.png" alt="누른 버튼 색 세 가지 비교: 갈색 12% 덧칠, 노랑 500 #ffcb70, 노랑 600 #f1ce88" loading="lazy"></figure>
</div>

결국 맨 처음 팔레트로 돌아가서 역할이 있는 네 단계만 남겼다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-04-yellow-four.png" alt="노랑 팔레트. 300 #ffebb3 고른 것·할 것, 400 #fae29f 브랜드·hover, 500 #ffcb70 뺀 값, 600 #f1ce88 누르는 순간, 900 #e5b16a 가장 높은 값" loading="lazy"></figure>
</div>

## 3. 노랑을 쓰지 않는 자리

브랜드 색을 입힌다고 또 너무 노랑노랑하게 만들고 싶지는 않았다. 노랑은 내가 고른 것, 할 것에만. 단계 표시처럼 상태를 알리는 곳에서는 빼고, 글자와 같은 진한 색으로 바꿨다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-05-phase-bar.png" alt="단계 표시 막대 전후 비교. 현재 단계가 전에는 노랑, 후에는 글자와 같은 진한 색" loading="lazy"></figure>
</div>

## 4. 앱은 앱대로, 대시보드는 대시보드대로

앱에 들어간 대시보드 스타일의 숫자 타일은 성적표같이 느껴졌다. 시스템은 하나로 두되, 특정 제품에서만 사용할 것들을 분류했다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-06-summary-number.png" alt="요약 숫자 전후 비교. 전에는 회색 타일 세 개에 큰 숫자, 후에는 타일 없이 구분선으로 나눈 작은 숫자" loading="lazy"></figure>
</div>

사이드바도 회색 바탕을 없앴다. 회색 위에서는 노랑이 보이지 않았다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-2/ds2-07-sidebar.png" alt="사이드바 전후 비교. 전에는 회색 바탕 위 연한 노랑 선택 항목, 후에는 흰 바탕 위 노랑 선택 항목" loading="lazy"></figure>
</div>

회색 바탕을 유지하면서 노랑을 진하게 만드는 대신에 노랑은 쓸 자리에서만 쓰자 싶었다.

이러는 와중에 새로운 화면이 생겼다. 새 화면에 대한 디자인 시스템 적용은 3탄에서...
