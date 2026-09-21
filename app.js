const form = document.querySelector('#survey-form');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let currentScreen = document.querySelector('#survey');
let changing = false;
let participantName = '';
async function showScreen(id) {
  if (changing) return;
  changing = true;
  const next = document.getElementById(id);
  currentScreen.inert = true;
  const canAnimate = !reducedMotion.matches && typeof currentScreen.animate === 'function';
  if (canAnimate) await currentScreen.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-8px)'}],{duration:220,easing:'ease-in',fill:'forwards'}).finished;
  currentScreen.hidden = true;
  currentScreen.getAnimations().forEach(animation => animation.cancel());
  currentScreen.inert = false;
  next.hidden = false;
  next.inert = true;
  window.scrollTo(0, 0);
  if (canAnimate) await next.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:380,easing:'ease-out'}).finished;
  next.inert = false;
  currentScreen = next;
  changing = false;
  next.querySelector('h1').focus({preventScroll:true});
}
for (const input of form.querySelectorAll('input')) {
  input.addEventListener('input', () => input.setCustomValidity(''));
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (changing) return;
  for (const input of form.querySelectorAll('input')) input.setCustomValidity(input.value.trim() ? '' : '내용을 입력해주세요.');
  if (!form.reportValidity()) return;
  participantName = document.querySelector('#participant-name').value.trim();
  document.querySelector('#recipient-name').textContent = participantName;
  document.title = `${participantName}의 생일을 축하합니다!`;
  playBirthdayMusic();
  await showScreen('birthday');
  document.querySelector('#music-toggle').hidden = false;

  burstConfetti();
});

const musicButton = document.querySelector('#music-toggle');
const birthdayAudio = document.querySelector('#birthday-audio');
birthdayAudio.volume = .4;
function updateMusicButton() {
  const playing = !birthdayAudio.paused && !birthdayAudio.ended;
  musicButton.textContent = playing ? '♫ 소리 끄기' : '♪ 노래 듣기';
  musicButton.setAttribute('aria-label', playing ? '생일 축하 노래 일시정지' : '생일 축하 노래 재생');
}
function playBirthdayMusic() {
  if (document.hidden) return;
  if (birthdayAudio.ended) birthdayAudio.currentTime = 0;
  birthdayAudio.play().then(updateMusicButton).catch(() => updateMusicButton());
}
musicButton.addEventListener('click', () => {
  if (birthdayAudio.paused || birthdayAudio.ended) playBirthdayMusic();
  else birthdayAudio.pause();
});
for (const event of ['play','pause','ended']) birthdayAudio.addEventListener(event, updateMusicButton);
birthdayAudio.addEventListener('error', () => {
  musicButton.textContent = '음악을 불러오지 못했어요';
  musicButton.setAttribute('aria-label', '음악을 불러오지 못했어요. 다시 재생 시도');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) birthdayAudio.pause();
});
let confettiFrame;
function burstConfetti() {
  if (reducedMotion.matches) return;
  const canvas = document.querySelector('#confetti');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  cancelAnimationFrame(confettiFrame);
  const width = innerWidth, height = innerHeight, ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  const colors = ['#d9a348','#638578','#ce7a83','#7797b6','#b09ac4'];
  const pieces = Array.from({length:95},(_,i) => ({x:width/2,y:height*.45,vx:(Math.random()-.5)*15,vy:-5-Math.random()*12,size:4+Math.random()*6,angle:Math.random()*6,color:colors[i%colors.length]}));
  let start,previous;
  function frame(now) {
    start ??= now; previous ??= now;
    const delta = Math.min((now-previous)/16.67,3);previous=now;
    ctx.clearRect(0,0,width,height);
    if(now-start>2600 || currentScreen.id!=='birthday' || reducedMotion.matches) return;
    ctx.globalAlpha=Math.min(1,(2600-(now-start))/700);
    for(const piece of pieces){
      piece.x+=piece.vx*delta;piece.y+=piece.vy*delta;piece.vy+=.16*delta;piece.angle+=.07*delta;
      ctx.save();ctx.translate(piece.x,piece.y);ctx.rotate(piece.angle);ctx.fillStyle=piece.color;ctx.fillRect(-piece.size/2,-piece.size/2,piece.size,piece.size*.5);ctx.restore();
    }
    confettiFrame=requestAnimationFrame(frame);
  }
  confettiFrame=requestAnimationFrame(frame);
}
document.querySelector('#to-gifts').addEventListener('click', () => showScreen('gifts'));
document.querySelector('#back-birthday').addEventListener('click', () => showScreen('birthday'));
const giftForm = document.querySelector('#gift-form');
let sending = false;
let sent = false;
giftForm.addEventListener('change', () => {
  if (sending || sent) return;
  const button = document.querySelector('#choose-gift');
  button.disabled = false;
  button.textContent = '이 선물로 선택해서 보내기 →';
  document.querySelector('#send-status').textContent = '';
});
giftForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || sent || changing) return;
  if (!giftForm.reportValidity()) return;
  const selected = giftForm.querySelector('input:checked');
  if (!selected) return;
  const status = document.querySelector('#send-status');
  const endpoint = window.BIRTHDAY_CONFIG?.formEndpoint || '';
  if (!/^https:\/\/formspree\.io\/f\/[a-zA-Z0-9]+$/.test(endpoint)) {
    status.textContent = '아직 선물 전달 기능을 준비 중이야. 잠시 후 다시 이용해줘.';
    return;
  }
  const button = document.querySelector('#choose-gift');
  const back = document.querySelector('#back-birthday');
  sending = true;
  button.disabled = true;
  back.disabled = true;
  giftForm.querySelector('fieldset').disabled = true;
  giftForm.setAttribute('aria-busy', 'true');
  button.textContent = '보내는 중…';
  status.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Accept: 'application/json'},
      body: JSON.stringify({
        school: document.querySelector('#school').value.trim(),
        name: participantName,
        gift: selected.value,
        _subject: '생일 선물 선택이 도착했어요'
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error('submission-failed');
    const receipt = await response.json();
    if (receipt.ok !== true) throw new Error('unconfirmed-submission');
    sent = true;
  document.querySelector('#selected-gift').textContent = selected.value;
  document.querySelector('#result-emoji').textContent = selected.parentElement.querySelector('.gift-emoji').textContent;
    await showScreen('result');
  } catch (error) {
    status.textContent = error.name === 'AbortError' || error instanceof TypeError
      ? '전송 여부를 확인하지 못했어. 다시 보내면 중복될 수 있으니 김아준에게 확인해줘.'
      : '전송 완료를 확인하지 못했어. 잠시 후 다시 시도하거나 김아준에게 알려줘.';
  } finally {
    clearTimeout(timeout);
    sending = false;
    giftForm.removeAttribute('aria-busy');
    if (!sent) {
      button.disabled = false;
      back.disabled = false;
      giftForm.querySelector('fieldset').disabled = false;
      button.textContent = '다시 보내기 →';
    }
  }
});


