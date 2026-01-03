document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 0. [NEW] 強制注入樣式 (修復 Agency 彈窗與按鈕)
    // ==========================================
    const style = document.createElement('style');
    style.innerHTML = `
        /* Agency Modal 專用樣式 */
        #agency-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); z-index: 20000;
            display: none; justify-content: center; align-items: center;
            backdrop-filter: blur(5px);
        }
        .agency-modal-box {
            width: 80%; max-width: 900px; height: 70vh;
            background: #111; border: 2px solid #00ff9d;
            box-shadow: 0 0 50px rgba(0, 255, 157, 0.2);
            display: flex; overflow: hidden; position: relative;
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .agency-modal-left { width: 50%; background: #000; display: flex; align-items: center; justify-content: center; }
        .agency-modal-left img { width: 100%; height: 100%; object-fit: contain; }
        .agency-modal-right { 
            width: 50%; padding: 40px; display: flex; flex-direction: column; justify-content: center; 
            text-align: left;
        }
        .agency-modal-right h4 { font-size: 2.5rem; color: #00f3ff; margin-bottom: 10px; font-family: 'Space Grotesk'; }
        .agency-modal-right p { color: #888; margin-bottom: 30px; font-size: 1.2rem; }
        
        /* 確保按鈕絕對可點 */
        .agency-modal-links { display: flex; flex-direction: column; gap: 15px; width: 100%; }
        .modal-link-btn {
            display: flex; align-items: center; justify-content: center; gap: 10px;
            padding: 12px; background: #222; color: #fff; text-decoration: none;
            border: 1px solid #444; transition: 0.2s; font-weight: bold; font-family: 'Space Grotesk';
            cursor: pointer; pointer-events: auto; /* 關鍵 */
        }
        .modal-link-btn:hover {
            background: #00ff9d; color: #000; border-color: #00ff9d; box-shadow: 0 0 15px #00ff9d;
        }
        .close-agency {
            position: absolute; top: 15px; right: 20px; color: #fff; font-size: 2rem; cursor: pointer; z-index: 10;
        }
        .close-agency:hover { color: #ff0055; }

        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 768px) {
            .agency-modal-box { flex-direction: column; height: 85vh; overflow-y: auto; }
            .agency-modal-left, .agency-modal-right { width: 100%; }
            .agency-modal-left { height: 40%; }
            .agency-modal-right { height: auto; padding: 20px; }
        }
    `;
    document.head.appendChild(style);

    // 建立 Agency Modal DOM
    const agencyModalHTML = `
        <div id="agency-modal-overlay">
            <div class="agency-modal-box">
                <span class="close-agency">&times;</span>
                <div class="agency-modal-left"><img id="agency-modal-img" src=""></div>
                <div class="agency-modal-right">
                    <h4 id="agency-modal-title">TITLE</h4>
                    <p id="agency-modal-desc">DESC</p>
                    <div id="agency-modal-links" class="agency-modal-links"></div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', agencyModalHTML);


    // ==========================================
    // 1. 系統變數與 DOM 初始化
    // ==========================================
    let currentZ = 0;
    let targetZ = 0;
    
    const world = document.getElementById('world');
    const stages = document.querySelectorAll('.stage');
    const zDisplay = document.getElementById('z-val');
    const progressBar = document.getElementById('scroll-progress');
    const startHint = document.querySelector('.start-hint');
    const flyingLogo = document.getElementById('flying-logo');
    
    const startOverlay = document.getElementById('start-overlay');
    const startBtn = document.getElementById('start-btn');
    const audioEl = document.getElementById('bg-music');
    const volSlider = document.getElementById('vol-slider');
    const volIcon = document.getElementById('vol-icon');

    const cursor = document.getElementById('cursor');
    const cursorTarget = document.getElementById('cursor-target');
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX, cursorY = mouseY;

    let audioCtx, analyser, dataArray;
    let isAudioInit = false;
    let bassLevel = 0;

    const stagePositions = Array.from(stages).map(s => parseInt(s.dataset.z));
    let currentStageIndex = 0;
    let isScrolling = false;
    const MAX_Z = stagePositions[stagePositions.length - 1];

    window.scrollTo(0, 0);


    // ==========================================
    // 2. 音訊系統
    // ==========================================
    startBtn.addEventListener('click', () => {
        startOverlay.classList.add('hidden');
        initAudio();
    });

    function initAudio() {
        if (isAudioInit) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
            const track = audioCtx.createMediaElementSource(audioEl);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
            track.connect(analyser);
            analyser.connect(audioCtx.destination);
            audioEl.volume = 0.5;
            audioEl.play().catch(e => console.log("Autoplay blocked:", e));
            isAudioInit = true;
        } catch (e) {
            audioEl.play();
        }
    }

    volSlider.addEventListener('input', (e) => {
        audioEl.volume = e.target.value;
        if(audioEl.volume === 0) volIcon.className = "fa-solid fa-volume-xmark";
        else if(audioEl.volume < 0.5) volIcon.className = "fa-solid fa-volume-low";
        else volIcon.className = "fa-solid fa-volume-high";
    });


    // ==========================================
    // 3. 游標系統
    // ==========================================
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        const target = e.target.closest('.hover-target, button, input, .cd-disc, .gear-card, .gallery-item, .time-node, .poster-card, a, .modal-link-btn');
        if (target) {
            document.body.classList.add('hovering');
            cursorTarget.innerText = "ACTIVE";
            cursorTarget.style.color = "#00ff9d";
        } else {
            document.body.classList.remove('hovering');
            cursorTarget.innerText = "SYSTEM";
            cursorTarget.style.color = "#00f3ff";
        }
    });

    function updateCursor() {
        cursorX += (mouseX - cursorX) * 0.15;
        cursorY += (mouseY - cursorY) * 0.15;
        cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
        requestAnimationFrame(updateCursor);
    }
    updateCursor();


    // ==========================================
    // 4. 滾動引擎
    // ==========================================
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (isScrolling) return;
        if (e.deltaY > 0) {
            if (currentStageIndex < stagePositions.length - 1) {
                currentStageIndex++;
                triggerScroll();
            }
        } else {
            if (currentStageIndex > 0) {
                currentStageIndex--;
                triggerScroll();
            }
        }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
        if (isScrolling) return;
        if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
            if (currentStageIndex < stagePositions.length - 1) {
                currentStageIndex++;
                triggerScroll();
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            if (currentStageIndex > 0) {
                currentStageIndex--;
                triggerScroll();
            }
        }
    });

    function triggerScroll() {
        isScrolling = true;
        targetZ = stagePositions[currentStageIndex];
        if (targetZ > 100 && startHint) startHint.style.opacity = 0;
        setTimeout(() => { isScrolling = false; }, 800);
    }


    // ==========================================
    // 5. CD 拖曳與點擊
    // ==========================================
    const draggables = document.querySelectorAll('.draggable-cd');
    draggables.forEach(disc => {
        let isDragging = false;
        let startX, startY;
        let hasMoved = false;

        disc.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            disc.style.transition = 'none';
            document.body.classList.add('dragging');
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            disc.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
        });

        window.addEventListener('mouseup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            document.body.classList.remove('dragging');
            disc.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            disc.style.transform = 'translate(0, 0) scale(1)';

            if (!hasMoved && e.target.closest('.draggable-cd') === disc) {
                const link = disc.dataset.link;
                if(link) window.open(link, '_blank');
            }
        });
    });


    // ==========================================
    // 6. Gallery 點擊放大 (Page 6)
    // ==========================================
    const galleryItems = document.querySelectorAll('.clickable-gallery');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.1);z-index:14000;display:none;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(overlay);

    galleryItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const isFocused = item.classList.contains('focused');
            galleryItems.forEach(i => i.classList.remove('focused'));
            
            if(!isFocused) {
                item.classList.add('focused');
                overlay.style.display = 'block';
                setTimeout(() => overlay.style.opacity = 1, 10);
            } else {
                item.classList.remove('focused');
                overlay.style.opacity = 0;
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        });
    });

    overlay.addEventListener('click', () => {
        galleryItems.forEach(i => i.classList.remove('focused'));
        overlay.style.opacity = 0;
        setTimeout(() => overlay.style.display = 'none', 300);
    });


    // ==========================================
    // 7. [REWRITTEN] Agency Modal Logic (Page 8)
    // ==========================================
    const posters = document.querySelectorAll('.expandable-card');
    const agencyModal = document.getElementById('agency-modal-overlay');
    const agencyImg = document.getElementById('agency-modal-img');
    const agencyTitle = document.getElementById('agency-modal-title');
    const agencyDesc = document.getElementById('agency-modal-desc');
    const agencyLinks = document.getElementById('agency-modal-links');
    const agencyClose = document.querySelector('.close-agency');

    posters.forEach(poster => {
        poster.addEventListener('click', () => {
            // 1. 獲取資料
            const showImg = poster.dataset.showImg;
            const title = poster.querySelector('h4').innerText;
            const desc = poster.querySelector('p').innerText;
            
            // 獲取隱藏的連結並轉換為新樣式按鈕
            const rawLinks = poster.querySelectorAll('.agency-links a');
            let buttonsHTML = '';
            rawLinks.forEach(link => {
                buttonsHTML += `<a href="${link.href}" target="_blank" class="modal-link-btn">${link.innerHTML}</a>`;
            });

            // 2. 填入 Modal
            agencyImg.src = showImg;
            agencyTitle.innerText = title;
            agencyDesc.innerText = desc;
            agencyLinks.innerHTML = buttonsHTML;

            // 3. 顯示 Modal
            agencyModal.style.display = 'flex';
        });
    });

    // 關閉 Agency Modal
    agencyClose.addEventListener('click', () => {
        agencyModal.style.display = 'none';
    });
    agencyModal.addEventListener('click', (e) => {
        if(e.target === agencyModal) agencyModal.style.display = 'none';
    });


    // ==========================================
    // 8. Timeline Image Modal (Page 7)
    // ==========================================
    const timeNodes = document.querySelectorAll('.time-node');
    const imgModal = document.getElementById('img-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModal = document.querySelector('.close-modal');

    timeNodes.forEach(node => {
        node.addEventListener('click', () => {
            const imgSrc = node.dataset.img;
            if(imgSrc) {
                modalContent.src = imgSrc;
                imgModal.style.display = 'flex';
            }
        });
    });

    if(closeModal) closeModal.addEventListener('click', () => imgModal.style.display = 'none');
    if(imgModal) imgModal.addEventListener('click', (e) => {
        if(e.target === imgModal) imgModal.style.display = 'none';
    });


    // ==========================================
    // 9. Mail Logic
    // ==========================================
    const checkboxes = document.querySelectorAll('.toggle-btn input');
    const msgDisplay = document.getElementById('msg-display');
    const mailBtn = document.getElementById('mail-btn');
    const emailLink = document.getElementById('email-link');

    if(checkboxes.length > 0) {
        checkboxes.forEach(cb => cb.addEventListener('change', () => {
            const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            msgDisplay.innerText = selected.length ? `SELECTED: [ ${selected.join(' + ')} ]` : 'READY TO TRANSMIT...';
            msgDisplay.style.color = selected.length ? '#00ff9d' : '#00f3ff';
        }));
    }

    if(mailBtn) {
        mailBtn.addEventListener('click', () => {
            const selected = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);
            if (!selected.length) { alert('PLEASE SELECT AT LEAST ONE MODULE.'); return; }
            
            const bodyText = `Hi 典恩，\n\n我們對以下項目有興趣：\n[ ${selected.join(' / ')} ]\n\n希望能進一步討論合作細節。\n\nBest Regards,`;
            
            navigator.clipboard.writeText(bodyText).then(() => {
                mailBtn.innerText = "COPIED! CLICK LINK BELOW";
                mailBtn.style.background = "#00ff9d"; mailBtn.style.color = "#000";
                emailLink.style.display = 'block';
            });
        });
    }


    // ==========================================
    // 10. Render Loop & Effects
    // ==========================================
    const counters = document.querySelectorAll('.counter');
    let hasAnimatedData = false;

    function animateCounters() {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const increment = target / 100;
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

    function updateWorld() {
        currentZ += (targetZ - currentZ) * 0.08;
        if(zDisplay) zDisplay.innerText = Math.floor(currentZ);
        if(progressBar) {
            const progress = Math.min((currentZ / MAX_Z) * 100, 100);
            progressBar.style.width = `${progress}%`;
        }
        
        // Flying Logo Logic
        if (currentZ > 500) {
            flyingLogo.classList.remove('centered');
            flyingLogo.classList.add('docked');
        } else {
            flyingLogo.classList.remove('docked');
            flyingLogo.classList.add('centered');
        }

        if (!hasAnimatedData && Math.abs(6000 - currentZ) < 500) {
            hasAnimatedData = true;
            animateCounters();
        }
        
        if (isAudioInit && analyser) {
            analyser.getByteFrequencyData(dataArray);
            let bassTotal = 0;
            for(let i=0; i<10; i++) bassTotal += dataArray[i];
            bassLevel = bassTotal / 10;
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

        requestAnimationFrame(updateWorld);
    }
    updateWorld();


    // ==========================================
    // 11. Visual Effects - Starfield
    // ==========================================
    const worldContainer = document.getElementById('world');
    document.addEventListener('mousemove', (e) => {
        const x = (window.innerWidth / 2 - e.clientX) / 100;
        const y = (window.innerHeight / 2 - e.clientY) / 100;
        if(worldContainer) worldContainer.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
    });

    const canvas = document.getElementById('warp-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let stars = [];
        
        function initStars() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            stars = [];
            for(let i=0; i<250; i++) {
                stars.push({ x: Math.random()*width-width/2, y: Math.random()*height-height/2, z: Math.random()*2000 });
            }
        }
        
        function drawStars() {
            ctx.fillStyle = `rgba(5, 5, 5, ${0.4})`;
            ctx.fillRect(0, 0, width, height);
            ctx.translate(width/2, height/2);
            const mouseCX = mouseX - width/2;
            const mouseCY = mouseY - height/2;

            stars.forEach(star => {
                let speed = 2 + (Math.abs(targetZ - currentZ) * 0.05) + (bassLevel * 0.05);
                star.z -= speed;
                if(star.z <= 0) { star.z = 2000; star.x = Math.random()*width-width/2; star.y = Math.random()*height-height/2; }
                const k = 200 / star.z;
                const px = star.x * k;
                const py = star.y * k;
                const size = (1 - star.z / 2000) * 3;
                let r = 255, g = 255, b = 255;
                if (bassLevel > 150) { r = 188; g = 19; b = 254; } 
                else if (bassLevel > 100) { r = 0; g = 255; b = 157; }

                ctx.beginPath();
                ctx.arc(px, py, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${1 - star.z/2000})`; 
                ctx.fill();

                const dx = px - mouseCX;
                const dy = py - mouseCY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(mouseCX, mouseCY);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - dist/150})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });
            ctx.translate(-width/2, -height/2);
            requestAnimationFrame(drawStars);
        }
        
        window.addEventListener('resize', initStars);
        initStars();
        drawStars();
    }
});
