"use strict";

// 이 프로젝트만의 키를 사용하여 다른 프로젝트의 저장 데이터와 구분합니다.
const STORAGE_KEY = "coin-note.watchlist.v1";
const form = document.querySelector("#coin-form");
const list = document.querySelector("#coin-list");
const statusMessage = document.querySelector("#status");
const cancelButton = document.querySelector("#cancel-button");
const fields = Object.fromEntries(["name", "symbol", "price", "quantity", "memo"].map(key => [key, document.getElementById(key)]));
let coins = [];
let editingId = null;
let storageReady = true;

function announce(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

// 저장 데이터가 손상된 경우 자동으로 덮어쓰지 않고 원본을 보존합니다.
function loadCoins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return;
    const data = JSON.parse(raw);
    const validCoin = coin => coin && typeof coin.id === "string" && coin.id.length > 0 &&
      typeof coin.name === "string" && coin.name.trim().length > 0 &&
      typeof coin.symbol === "string" && coin.symbol.trim().length > 0 &&
      Number.isFinite(coin.price) && coin.price >= 0 &&
      Number.isFinite(coin.quantity) && coin.quantity > 0 &&
      Number.isFinite(coin.price * coin.quantity) && typeof coin.memo === "string";
    if (!Array.isArray(data) || !data.every(validCoin) || new Set(data.map(coin => coin.id)).size !== data.length) {
      throw new Error("Invalid data");
    }
    coins = data;
  } catch {
    storageReady = false;
    announce("저장 데이터를 읽을 수 없습니다. 원본 보존을 위해 등록·변경을 중지했습니다. 브라우저 저장소 설정과 저장 데이터를 확인해 주세요.", true);
    form.querySelector("button[type=submit]").disabled = true;
  }
}

// 저장이 성공했을 때만 화면의 데이터를 변경합니다.
function persist(nextCoins) {
  if (!storageReady) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCoins));
    coins = nextCoins;
    return true;
  } catch {
    announce("저장하지 못했습니다. 저장 공간이나 브라우저 저장소 권한을 확인한 후 다시 시도해 주세요.", true);
    return false;
  }
}

const formatNumber = value => new Intl.NumberFormat("ko-KR", { maximumSignificantDigits: 15 }).format(value);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  list.replaceChildren();
  document.querySelector("#coin-count").textContent = coins.length;
  if (!coins.length) {
    const empty = element("div", "empty");
    empty.append(element("strong", "", "아직 등록한 관심 코인이 없어요"), element("span", "", "코인을 등록하고 나만의 투자 노트를 시작하세요."));
    list.append(empty);
    return;
  }
  // 사용자 입력은 innerHTML 대신 textContent로 출력하여 HTML 실행을 방지합니다.
  coins.forEach(coin => {
    const card = element("article", `coin-card${coin.id === editingId ? " editing" : ""}`);
    const top = element("div", "coin-top");
    const title = element("div");
    title.append(element("h3", "coin-title", coin.name), element("span", "symbol", coin.symbol));
    const actions = element("div", "card-actions");
    for (const [action, label] of [["edit", "수정"], ["delete", "삭제"]]) {
      const button = element("button", action === "delete" ? "danger" : "", label);
      button.type = "button";
      button.dataset.action = action;
      button.dataset.id = coin.id;
      button.setAttribute("aria-label", `${coin.name} ${label}`);
      actions.append(button);
    }
    top.append(title, actions);
    const metrics = element("dl", "metrics");
    for (const [label, value] of [["매수가", `${formatNumber(coin.price)} 원`], ["보유 수량", `${formatNumber(coin.quantity)} ${coin.symbol}`], ["총 매수금액", `${formatNumber(coin.price * coin.quantity)} 원`]]) {
      const metric = element("div");
      metric.append(element("dt", "", label), element("dd", "", value));
      metrics.append(metric);
    }
    card.append(top, metrics, element("div", "memo", coin.memo || "등록된 메모가 없습니다."));
    list.append(card);
  });
}

function resetEditor() {
  editingId = null;
  form.reset();
  Object.values(fields).forEach(field => field.setCustomValidity(""));
  document.querySelector("#form-title").textContent = "관심 코인 등록";
  document.querySelector("#mode-label").textContent = "NEW";
  document.querySelector("#save-button").textContent = "관심 코인 등록";
  cancelButton.hidden = true;
}

Object.values(fields).forEach(field => field.addEventListener("input", () => field.setCustomValidity("")));
form.addEventListener("submit", event => {
  event.preventDefault();
  if (!storageReady) return;
  const name = fields.name.value.trim();
  const symbol = fields.symbol.value.trim().toUpperCase();
  const price = Number(fields.price.value);
  const quantity = Number(fields.quantity.value);
  // 공백뿐인 이름, 음수, 무한대 및 계산할 수 없는 금액을 검사합니다.
  fields.name.setCustomValidity(name ? "" : "코인명을 입력해 주세요.");
  fields.symbol.setCustomValidity(symbol ? "" : "코인 심볼을 입력해 주세요.");
  fields.price.setCustomValidity(fields.price.value !== "" && Number.isFinite(price) && price >= 0 ? "" : "매수가는 0 이상의 유효한 숫자로 입력해 주세요.");
  fields.quantity.setCustomValidity(fields.quantity.value !== "" && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price * quantity) ? "" : "수량은 0보다 크고 총 매수금액을 계산할 수 있는 숫자로 입력해 주세요.");
  if (!form.reportValidity()) return;
  const wasEditing = editingId !== null;
  const coin = { id: editingId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`), name, symbol, price, quantity, memo: fields.memo.value.trim() };
  const nextCoins = wasEditing ? coins.map(item => item.id === editingId ? coin : item) : [coin, ...coins];
  if (!persist(nextCoins)) return;
  resetEditor();
  render();
  announce(wasEditing ? "관심 코인을 수정했습니다." : "관심 코인을 등록했습니다.");
});

// 목록의 버튼 클릭을 한곳에서 처리합니다. 이름이 같아도 고유 ID로 구분합니다.
list.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const coin = coins.find(item => item.id === button.dataset.id);
  if (!coin) return;
  if (button.dataset.action === "edit") {
    if (editingId && !window.confirm("현재 수정 내용을 버리고 다른 코인을 수정할까요?")) return;
    editingId = coin.id;
    Object.entries(fields).forEach(([key, field]) => { field.value = coin[key]; field.setCustomValidity(""); });
    document.querySelector("#form-title").textContent = "관심 코인 수정";
    document.querySelector("#mode-label").textContent = "EDIT";
    document.querySelector("#save-button").textContent = "수정 내용 저장";
    cancelButton.hidden = false;
    render();
    announce(`${coin.name} 수정 중입니다.`);
    fields.name.focus();
  } else if (window.confirm(`${coin.name} (${coin.symbol}) 기록을 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) {
    if (!persist(coins.filter(item => item.id !== coin.id))) return;
    if (editingId === coin.id) resetEditor();
    render();
    announce("관심 코인을 삭제했습니다.");
  }
});

cancelButton.addEventListener("click", () => {
  resetEditor();
  render();
  announce("수정을 취소했습니다. 기존 기록은 유지됩니다.");
  fields.name.focus();
});

// 다른 탭에서 변경한 데이터를 다시 읽어 오래된 목록으로 덮어쓰는 것을 줄입니다.
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  storageReady = true;
  resetEditor();
  loadCoins();
  document.querySelector("#save-button").disabled = !storageReady;
  render();
  if (storageReady) announce("다른 탭의 변경 사항을 반영했습니다.");
});

loadCoins();
render();
