document.addEventListener('DOMContentLoaded', () => {
    
    // --- 系統參數 ---
    const MAX_Z = 12000;
    const SPEED_FACTOR = 5;
    let currentZ = 0;
    let targetZ = 0;
    
    // DOM
    const world = document.getElementById('world');
    const stages = document.querySelectorAll('.stage');
    const zDisplay = document.getElementById('z-val');
    const progressBar = document.getElementById('scroll-progress');
    const startHint = document.querySelector('.start-hint');
    
    // Audio Elements
    const startOverlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');
    const audioEl = document.getElementById('bg-music');
    const volSlider = document.getElementById('vol-slider');
    const volIcon = document.getElementById('vol-icon');

    // Audio Context Vars
    let audioCtx, analyser, dataArray;
    let isAudioInit = false;
    let bassLevel = 0; // 0 ~ 255

    window.scrollTo(0, 0);

    // --- 1. 系統啟動 (Initialize) ---
    startBtn.addEventListener('click', () => {
        startOverlay.classList.add('hidden');
        initAudio();
    });

    function initAudio() {
        if (isAudioInit) return;
        
        try {
            // 建立 AudioContext
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            
            // 建立來源與分析器
            const track = audioCtx.createMediaElementSource(audioEl);
            analyser = audioCtx.createAnalyser();
            
            // 設定 FFT (Fast Fourier Transform)
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            // 連接節點: Source -> Analyser -> Destination (喇叭)
            track.connect(analyser);
            analyser.connect(audioCtx.destination);

            // 播放
            audioEl.volume = 0.5;
            audioEl.play().catch(e => console.log("Play error:", e));
            isAudioInit = true;

        } catch (e) {
            console.warn("Web Audio API not supported or blocked", e);
            // Fallback: 至少讓音樂播出來
            audioEl.play();
        }
    }

    // 音量控制
    volSlider.addEventListener('input', (e) => {
        audioEl.volume = e.target.value;
        if(audioEl.volume === 0) volIcon.className = "fa-solid fa-volume-xmark";
        else if(audioEl.volume < 0.5) volIcon.className = "fa-solid fa-volume-low";
        else volIcon.className = "fa-solid fa-volume-high";
    });

    volIcon.addEventListener('click', () => {
        if(audioEl.muted) {
            audioEl.muted = false;
            volIcon.className = "fa-solid fa-volume-high";
        } else {
            audioEl.muted = true;
            volIcon.className = "fa-solid fa-volume-xmark";
        }
    });


    // --- 2. 核心飛行引擎 ---
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        targetZ += e.deltaY * SPEED_FACTOR;
        if (targetZ < 0) targetZ = 0;
        if (targetZ > MAX_Z + 500) targetZ = MAX_Z + 500;
        if (targetZ > 100 && startHint) startHint.style.opacity = 0;
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
        const step = 400;
        if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') targetZ += step;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') targetZ -= step;
        if (targetZ < 0) targetZ = 0;
        if (targetZ > MAX_Z + 500) targetZ = MAX_Z + 500;
        if (targetZ > 100 && startHint) startHint.style.opacity = 0;
    });

    let touchStartY = 0;
    window.addEventListener('touchstart', e => touchStartY = e.touches[0].clientY, { passive: true });
    window.addEventListener('touchmove', e => {
        const deltaY = touchStartY - e.touches[0].clientY;
        targetZ += deltaY * 3;
        touchStartY = e.touches[0].clientY;
        if (targetZ < 0) targetZ = 0;
        if (targetZ > MAX_Z + 500) targetZ = MAX_Z + 500;
    }, { passive: true });


    // --- 3. 數字跳動動畫 ---
    const counters = document.querySelectorAll('.counter');
    let hasAnimatedData = false;
    function animateCounters() {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            const updateCount = () => {
                current += increment;
                if (current < target) {
                    counter.innerText = Math.ceil(current);
                    requestAnimationFrame(updateCount);
                } else {
                    counter.innerText = target;
                }
            };
            updateCount();
        });
    }

    // --- 4. Render Loop (包含 Audio Analysis) ---
    function updateWorld() {
        currentZ += (targetZ - currentZ) * 0.08;
        
        if(zDisplay) zDisplay.innerText = Math.floor(currentZ);
        if(progressBar) {
            const progress = Math.min((currentZ / MAX_Z) * 100, 100);
            progressBar.style.width = `${progress}%`;
        }

        if (!hasAnimatedData && Math.abs(5500 - currentZ) < 800) {
            hasAnimatedData = true;
            animateCounters();
        }

        // --- Audio Analysis ---
        if (isAudioInit && analyser) {
            analyser.getByteFrequencyData(dataArray);
            // 取低頻段的平均值 (Bass)
            let bassTotal = 0;
            // 取前 10 個頻段 (通常是低音)
            for(let i=0; i<10; i++) {
                bassTotal += dataArray[i];
            }
            bassLevel = bassTotal / 10; // 平均值 0-255
        }

        stages.forEach(stage => {
            const stageZ = parseInt(stage.dataset.z);
            const dist = stageZ - currentZ;
            let opacity = 0;
            let pointerEvents = 'none';
            let blur = 0;

            if (dist > -800 && dist < 1200) {
                opacity = 1 - Math.abs(dist) / 1000;
                if (opacity > 1) opacity = 1;
                if (opacity < 0) opacity = 0;
                if (dist > -200 && dist < 500) pointerEvents = 'auto';
                else blur = Math.min(10, Math.abs(dist) / 100);
            }
            stage.style.transform = `translate(-50%, -50%) translateZ(${dist}px)`;
            stage.style.opacity = opacity;
            stage.style.pointerEvents = pointerEvents;
            stage.style.filter = `blur(${blur}px)`;
            stage.style.display = (opacity <= 0.01) ? 'none' : 'flex';
        });

        warpSpeed = (targetZ - currentZ) * 0.1;
        requestAnimationFrame(updateWorld);
    }
    updateWorld();

    document.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.clientX) / 100;
        const y = (window.innerHeight / 2 - e.clientY) / 100;
        if(world) world.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
    });

    // --- 5. Starfield (Audio Reactive) ---
    const canvas = document.getElementById('warp-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let stars = [];
        let warpSpeed = 0;

        function initStars() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            stars = [];
            for(let i=0; i<300; i++) {
                stars.push({ x: Math.random()*width-width/2, y: Math.random()*height-height/2, z: Math.random()*2000 });
            }
        }

        function drawStars() {
            // 背景色隨 Bass 輕微閃爍
            // bassLevel (0-255) -> opacity (0.05 - 0.15)
            const bgOpacity = 0.05 + (bassLevel / 255) * 0.1;
            ctx.fillStyle = `rgba(5, 5, 5, ${0.5})`; // 殘影效果
            ctx.fillRect(0, 0, width, height);
            
            ctx.translate(width/2, height/2);
            stars.forEach(star => {
                let speed = 2 + Math.abs(warpSpeed) + (bassLevel * 0.05); // Bass 越重跑越快
                star.z -= speed;
                if(star.z <= 0) { star.z = 2000; star.x = Math.random()*width-width/2; star.y = Math.random()*height-height/2; }
                const k = 200 / star.z;
                const px = star.x * k;
                const py = star.y * k;
                const size = (1 - star.z / 2000) * 3;
                
                ctx.beginPath();
                
                // 顏色隨 Bass 改變
                let r = 255, g = 255, b = 255;
                if (bassLevel > 150) { // 重低音時變色
                    r = 188; g = 19; b = 254; // Neon Purple
                } else if (bassLevel > 100) {
                    r = 0; g = 255; b = 157; // Neon Green
                }

                if (Math.abs(warpSpeed) > 2) {
                    ctx.moveTo(px, py); ctx.lineTo(px * 1.05, py * 1.05);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - star.z/2000})`; ctx.lineWidth = size; ctx.stroke();
                } else {
                    ctx.arc(px, py, size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${1 - star.z/2000})`; ctx.fill();
                }
            });
            ctx.translate(-width/2, -height/2);
            requestAnimationFrame(drawStars);
        }
        window.addEventListener('resize', initStars);
        initStars();
        drawStars();
    }

    // Collab Logic
    const checkboxes = document.querySelectorAll('.toggle-btn input');
    const msgDisplay = document.getElementById('msg-display');
    const copyBtn = document.getElementById('copy-btn');
    if(checkboxes.length > 0) {
        checkboxes.forEach(cb => cb.addEventListener('change', () => {
            const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            msgDisplay.innerText = selected.length ? `SELECTED: [ ${selected.join(' + ')} ]` : 'READY TO TRANSMIT...';
            msgDisplay.style.color = selected.length ? '#00ff9d' : '#00f3ff';
        }));
    }
    if(copyBtn) {
        copyBtn.addEventListener('click', () => {
            const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            if (!selected.length) { alert('PLEASE SELECT AT LEAST ONE MODULE.'); return; }
            const text = `Hi 典恩，我們對 [ ${selected.join(' / ')} ] 有興趣，希望能進一步討論合作細節。`;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "COPIED!";
                copyBtn.style.background = "#00ff9d"; copyBtn.style.color = "#000";
                setTimeout(() => { copyBtn.innerText = originalText; copyBtn.style.background = ""; copyBtn.style.color = ""; }, 2000);
            });
        });
    }
});
