---
layout: post
title: "EFG 개발기: 정리, 정리, 정리... 디자인 시스템 1탄"
description: EFG 디자인 시스템을 정리하며 예외를 줄이고, 따뜻한 톤과 웹 접근성 사이에서 고민한 기록.
---
이것을 내가 정리하는 게 맞나 싶긴 한데 더 개발하기 전에 정리하기로 마음먹었으니.

디자인 시스템이 있긴 했지만, 그동안 개발자(어쩌면 클로드)가 임의로 만든 컴포넌트나 페이지가 너무 많았다. 새로 화면을 구성해 보려 해도 기존에 있는 것들 중 정말로 사용해도 되는, 디자인 시스템을 고려한 컴포넌트가 무엇인지 알기 어려워서 이참에 정리를 해 보려 했다. 그리고 뒤지게 어렵다...! 머리가 아프다!

가장 먼저 고려했던 것들은 일단 이렇게였다.

1. 예외 줄이기
2. 부드럽고 따뜻한 톤 유지하기
3. 웹 접근성과 상태 표현(hover, pressed...)

## 1. 예외 줄이기

같은 역할인데 컴포넌트마다 생김새가 달랐다. 버튼만 해도 종류가 여섯 가지, 모서리는 크기마다 6, 8, 10, 12px.
모서리는 전체 컴포넌트 기준 네 단계로, hover와 pressed는 같은 규칙으로, 버튼 종류는 네 가지로 줄였다. 빨간 삭제 버튼은 없애고, 링크는 버튼에서 빼서 밑줄 글자로 남겼다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-1/ds1-01-button-types-sizes.png" alt="버튼 종류와 크기별 모서리 전후 비교. 전: 종류 여섯 가지, 모서리 6·8·10·12px. 후: 종류 네 가지, 모서리 8·12px" loading="lazy"></figure>
</div>

## 2. 부드럽고 따뜻한 톤 유지하기

파스텔 색상은 그대로 사용했다. 대비 때문에 차트 색을 진하게 바꿔 봤다가 분위기가 너무 달라서 다시 돌아왔다. 구분은 색 대신 값 표기로 타협했다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-1/ds1-07-chart-bar.png" alt="막대 차트 전후 비교. 파스텔 색은 그대로 두고, 후에는 막대 위에 값을 표기" loading="lazy"></figure>
</div>

## 3. 웹 접근성과 상태 표현

WCAG 대비 기준(글자 4.5:1, 테두리 3:1)으로 재 보니 input 밑줄 1.27:1, outline 버튼 테두리 1.28:1, 보조 글자 3.2:1. 선택한 칸은 테두리도 글자도 연노랑이라 오히려 제일 눈에 안 들어왔다.

input은 형태는 그대로 두고 밑줄만 진하게, 에러는 원래의 대시보드 쪽 규칙과 맞춰 배경을 채웠다. 상태는 기본, hover, pressed, selected, focus, disabled로 웹과 모바일이 같이 사용할 수 있도록 했다.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-1/ds1-02-input-states-en.png" alt="입력창 기본·focus·error 상태 전후 비교. 후에는 밑줄이 진해지고 에러 칸은 배경을 채움" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-1/ds1-04-outline-button.png" alt="외곽선 버튼 전후 비교. 연노랑 테두리가 진한 회색 테두리로 바뀜" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-1/ds1-10-checkbox-en.png" alt="체크박스 off·on 전후 비교. 후에는 글자가 진해지고 켜짐 상태가 진한 갈색으로 채워짐" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-1/ds1-03-choice.png" alt="선택지 전후 비교. 전에는 선택한 칸이 연노랑 테두리와 글자, 후에는 진한 테두리와 체크 표시" loading="lazy"></figure>
</div>

그런데... 이렇게 변경하고 보니 화면이 너무 딱딱하게 느껴졌다. 처음의 따뜻한 톤 유지하기는 어디로 간 거지?

- 버튼 상태에 따라서 너무 ㄸ색으로 보이는데...
- 사이드바의 회색 배경에 노랑 강조색은 너무 안 보이는데...

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-1/ds1-05-button-pressed.png" alt="로그인 버튼 기본·pressed 전후 비교. 후의 pressed 색이 탁한 황토색" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-1/ds1-14-sidebar-nav.png" alt="사이드바 메뉴 전후 비교. 후에는 회색 배경 위 선택 항목이 연노랑으로 표시됨" loading="lazy"></figure>
</div>

아무래도 이유는 아래 두 가지 같다.

- 켜짐, 선택, 진행, 포커스가 전부 진한 갈색으로 바뀌어 버림.
- 대시보드를 위해 만든 규칙이 여유가 필요한 앱 화면에도 그대로 적용돼버림.

<div class="shots wide">
  <figure><img src="/assets/efg-design-system-1/ds1-09-progress.png" alt="진행 막대 전후 비교. 파스텔 그라데이션이 진한 갈색 막대로 바뀜" loading="lazy"></figure>
  <figure><img src="/assets/efg-design-system-1/ds1-15-tile-no-stone.png" alt="상담 횟수·이번 주 자기돌봄 타일 전후 비교. 후에는 라벨이 위, 숫자가 크게 아래로 배치됨" loading="lazy"></figure>
</div>

결국 다시 수정 중인 2탄이...
