(() => {
"use strict";

const VERSION = "CAA-1.0-web.3";
const SCORING_VERSION = "SC-1.0";
const ROUTER_VERSION = "AR-1.0";
const EVALUATOR_VERSION = "EC-1.0";

const $ = (s) => document.querySelector(s);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "sess-"+Date.now()+"-"+Math.random().toString(36).slice(2));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

const state = {
  session_id: uid(),
  started_at: new Date().toISOString(),
  administration: {},
  responses: [],
  lastResponseIndex: null,
  completedSteps: 0,
  estimatedSteps: 72,
  phase1: {},
  adaptive: {},
  phase2_trace: [],
  phase3_flags: [],
  phase3Domains: [],
  lr_encoded_at: null,
  integrity: [],
};

function markPhase(label) {
  $("#phase-label").textContent = label;
}
function tickProgress() {
  state.completedSteps++;
  const p = Math.min(96, Math.round((state.completedSteps/state.estimatedSteps)*100));
  $("#progress-label").textContent = p+"%";
  $("#progress-fill").style.width = p+"%";
  persist();
}
function persist() {
  try { localStorage.setItem("caa-last-session", JSON.stringify({version:VERSION,state})); } catch(_) {}
}
function record(r) {
  state.responses.push({
    item_id:r.item_id, phase:r.phase, domain:r.domain, prompt:r.prompt,
    answer:r.answer ?? null, key:r.key ?? null, score:r.score ?? null,
    rt_ms:r.rt_ms ?? null, confidence:null, changed_answer:false, flags:r.flags || [],
    level:r.level ?? null
  });
  state.lastResponseIndex = state.responses.length-1;
  persist();
}
function confidenceTrial(phaseLabel) {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble: '<div class="subq">Mức chắc chắn về câu vừa trả lời</div>',
    html: '<div class="range-row"><input id="cf" name="confidence" type="range" min="0" max="100" value="70" oninput="document.getElementById(\'cfv\').value=this.value"><output id="cfv">70</output></div>',
    button_label:"Tiếp tục",
    on_start:()=>markPhase(phaseLabel),
    on_finish:(data)=>{
      if(state.lastResponseIndex!==null && data.response) {
        state.responses[state.lastResponseIndex].confidence = Number(data.response.confidence);
      }
      tickProgress();
    }
  };
}
function mcTrial(item, phaseLabel="Phase 1") {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="question">'+item.prompt+'</div>'+(item.note?'<div class="subq">'+item.note+'</div>':''),
    choices:item.options,
    on_start:()=>markPhase(phaseLabel),
    on_finish:(data)=>{
      const idx = data.response;
      record({
        item_id:item.id, phase:item.phase||1, domain:item.domain, prompt:item.prompt,
        answer:idx===null?null:item.options[idx], key:item.options[item.key],
        score:idx===item.key?1:0, rt_ms:data.rt, level:item.level||null,
        flags:idx===null?["NO_RESPONSE"]:[]
      });
      tickProgress();
    }
  };
}
function textRecall(item, phaseLabel="Phase 1") {
  return {
    type: jsPsychSurveyHtmlForm,
    preamble:'<div class="question">'+item.prompt+'</div>',
    html:'<label for="ans">Trả lời</label><input id="ans" name="answer" type="text" autocomplete="off" required>',
    button_label:"Xác nhận",
    autofocus:"ans",
    on_start:()=>markPhase(phaseLabel),
    on_finish:(data)=>{
      const raw = String(data.response?.answer||"").trim();
      const norm = raw.toUpperCase().replace(/[\s–—-]/g,"").replace(/，/g,",");
      const keys = Array.isArray(item.key) ? item.key : [item.key];
      const ok = keys.map(x=>String(x).toUpperCase().replace(/[\s–—-]/g,"")).includes(norm);
      record({item_id:item.id,phase:item.phase||1,domain:item.domain,prompt:item.prompt,answer:raw,key:keys.join(" / "),score:ok?1:0,rt_ms:data.rt,flags:[]});
      tickProgress();
    }
  };
}
function showTimed(html, ms, phaseLabel, onFinish) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus:html,
    choices:"NO_KEYS",
    trial_duration:ms,
    on_start:()=>markPhase(phaseLabel),
    on_finish:()=>{ if(onFinish) onFinish(); tickProgress(); }
  };
}

const P1 = {
 GF:[
  {id:"F1",domain:"GF",prompt:"Dãy số: 2, 5, 11, 23, 47, ?",options:["71","94","95","97"],key:2},
  {id:"F2",domain:"GF",prompt:"Mọi Ral đều là Tiv. Không Tiv nào là Nox. Có một số Pex là Ral. Kết luận nào bắt buộc đúng?",options:["Có một số Pex không phải Nox.","Mọi Pex đều không phải Nox.","Không Pex nào là Nox.","Có một số Nox không phải Pex."],key:0},
  {id:"F3",domain:"GF",prompt:"Một phép biến đổi lấy bộ ba chữ cái, đảo thứ tự rồi tăng mỗi chữ lên 1 bậc. Ví dụ (A,D,F) → (G,E,B). Với (M,Q,T), kết quả là?",options:["(U,R,N)","(T,Q,M)","(U,Q,N)","(N,R,U)"],key:0},
  {id:"F4",domain:"GF",prompt:"Nếu A→B. Nếu B thì đúng chính xác một trong C hoặc D. Nếu C→không E. Biết A đúng và E đúng. Điều nào bắt buộc đúng?",options:["C đúng","D đúng","B sai","Không suy ra được"],key:1}
 ],
 QR:[
  {id:"Q1",domain:"QR",prompt:"Một giá trị tăng 20% rồi giảm 20% so với giá trị mới. So với ban đầu, kết quả là:",options:["Bằng nhau","Tăng 4%","Giảm 4%","Giảm 2%"],key:2},
  {id:"Q2",domain:"QR",prompt:"x + y = 54 và x = 2y − 3. x bằng:",options:["33","35","36","37"],key:1},
  {id:"Q3",domain:"QR",prompt:"Máy A làm 3 đơn vị trong 4 phút. Máy B làm 5 đơn vị trong 6 phút. Nếu chạy đồng thời 12 phút, tổng sản lượng là:",options:["17","18","19","20"],key:2},
  {id:"Q4",domain:"QR",prompt:"Có 120 hồ sơ. 45% qua vòng 1. Trong số đã qua, 1/3 qua vòng 2. Có bao nhiêu hồ sơ qua cả hai vòng?",options:["16","18","20","24"],key:1}
 ],
 VC:[
  {id:"V1",domain:"VC",prompt:"Nhóm làm từ xa có năng suất trung bình cao hơn nhóm tại văn phòng, nhưng nhóm làm từ xa chủ yếu là nhân viên thâm niên cao. Kết luận chặt chẽ nhất?",options:["Làm từ xa chắc chắn tăng năng suất.","Thâm niên chắc chắn là nguyên nhân duy nhất.","Chưa thể quy toàn bộ khác biệt cho hình thức làm việc.","Không có liên hệ nào giữa hình thức làm việc và năng suất."],key:2},
  {id:"V2",domain:"VC",prompt:"“Sản phẩm A có nhiều đánh giá 5 sao hơn B, nên A chắc chắn tốt hơn B.” Điểm yếu trực tiếp nhất?",options:["Không nêu giá.","Không kiểm soát số lượng người đánh giá và cách lấy mẫu.","Không mô tả màu.","Không cho biết ngày phát hành."],key:1},
  {id:"V3",domain:"VC",prompt:"“Mô hình” đối với “hệ thống thật” giống nhất với:",options:["bản đồ : lãnh thổ","từ điển : ngôn ngữ","nhiệt kế : nhiệt độ","chìa khóa : ổ khóa"],key:0},
  {id:"V4",domain:"VC",prompt:"Câu nào diễn đạt chính xác nhất “tương quan không chứng minh quan hệ nhân quả”?",options:["Hai biến đi cùng nhau thì không bao giờ có nhân quả.","Hai biến cùng thay đổi chưa đủ để kết luận biến này gây ra biến kia.","Mọi tương quan đều do biến thứ ba.","Nhân quả chỉ tồn tại trong thí nghiệm."],key:1}
 ],
 VS:[
  {id:"S1",domain:"VS",prompt:"Một mũi tên ↗ phản chiếu qua trục dọc sẽ thành:",options:["↖","↘","↙","↗"],key:0},
  {id:"S2",domain:"VS",prompt:"Một vật hướng Bắc. Nó quay phải 90°, quay trái 180°, rồi quay phải 90°. Hướng cuối:",options:["Bắc","Nam","Đông","Tây"],key:0},
  {id:"S3",domain:"VS",prompt:"Trên lưới 3×3, điểm P ở góc trên-trái. Xoay toàn lưới 90° theo chiều kim đồng hồ. P chuyển tới:",options:["trên-phải","dưới-phải","dưới-trái","giữa"],key:0},
  {id:"S4",domain:"VS",prompt:"Một tờ giấy vuông gập đôi theo chiều dọc rồi ngang. Đục một lỗ xuyên qua chồng giấy ở vị trí không nằm trên nếp gấp. Mở ra có bao nhiêu lỗ?",options:["2","3","4","8"],key:2}
 ]
};

const A = {
 GF:{
  1:[
   ["3, 6, 9, 12, ?",["14","15","16","18"],1],
   ["Nếu mọi Lur là Mek và An là Lur, điều nào chắc chắn đúng?",["An là Mek","Mọi Mek là Lur","An không là Mek","Không suy ra"],0],
   ["1, 4, 7, 10, ?",["11","12","13","14"],2]
  ],
  2:[
   ["4, 9, 19, 39, ?",["69","75","79","81"],2],
   ["Nếu A→B, B→C và A đúng, điều nào bắt buộc đúng?",["B sai","C đúng","C sai","Không biết B"],1],
   ["2, 6, 18, 54, ?",["108","126","162","216"],2]
  ],
  3:[
   ["Ba hộp X,Y,Z có đúng một hộp chứa đồng xu. X nói “xu không ở X”. Y nói “xu ở X”. Z nói “xu không ở Z”. Chỉ một câu nói đúng. Xu ở đâu?",["X","Y","Z","Không đủ dữ liệu"],2],
   ["Nếu P→Q; Q→(R hoặc S nhưng không cả hai); R→không T. Biết P và T đúng. Điều nào bắt buộc?",["R","S","không Q","không P"],1],
   ["A đứng trước B. C đứng sau B. D đứng trước A. Thứ tự nào bắt buộc đúng?",["D-A-B-C","A-D-B-C","D-B-A-C","C-B-A-D"],0]
  ],
  4:[
   ["Bốn người A,B,C,D mỗi người chọn một số khác nhau 1–4. A>B; A<C; C<D; B<C. Thứ tự giá trị từ nhỏ đến lớn là?",["B,A,C,D","B,C,A,D","A,B,C,D","D,C,B,A"],0],
   ["Ba biến P,Q,R có đúng hai biến đúng. Nếu P đúng thì Q sai. Nếu Q đúng thì P đúng. Cặp biến đúng là?",["P và R","P và Q","Q và R","Không xác định"],0],
   ["Một mã gồm 3 ký tự khác nhau từ A,B,C,D và bắt buộc có cả B,C. A không đầu; B đứng trước C; D không cuối. Mã nào hợp lệ?",["ABC","DBA","DBC","CAD"],2]
  ]
 },
 QR:{
  1:[
   ["25% của 80 bằng:",["15","20","25","30"],1],
   ["Nếu 3x=21 thì x=",["5","6","7","8"],2],
   ["Tỉ lệ 2:3 có tổng 25. Phần nhỏ là:",["8","10","12","15"],1]
  ],
  2:[
   ["Một món giảm 10% từ 500 rồi tăng 10% trên giá mới. Giá cuối:",["490","495","500","505"],1],
   ["2x+5=19. x=",["6","7","8","9"],1],
   ["Một xe đi 120 km trong 2 giờ rồi 60 km trong 1 giờ. Tốc độ trung bình toàn hành trình:",["55","60","65","70"],1]
  ],
  3:[
   ["A làm việc một mình 6 giờ, B 3 giờ. Cùng làm, thời gian là:",["1 giờ","2 giờ","2.5 giờ","3 giờ"],1],
   ["Một số tăng 50% rồi cần giảm bao nhiêu % để về số cũ?",["25%","30%","33⅓%","50%"],2],
   ["x:y=3:5 và y:z=10:7. x:z bằng:",["3:7","6:7","5:7","6:5"],1]
  ],
  4:[
   ["Một bể đầy bằng ống A trong 4h, B trong 6h; ống thoát C làm cạn trong 12h. Mở cả ba từ rỗng, đầy sau:",["2h","3h","4h","6h"],1],
   ["Giá trị kỳ vọng: 40% nhận 100, 60% mất 20. EV =",["16","24","28","40"],2],
   ["Một lượng tăng x% rồi giảm x% và còn 96% ban đầu. x =",["10%","20%","25%","40%"],1]
  ]
 },
 VC:{
  1:[
   ["“Không phải mọi A đều là B” tương đương nhất với:",["Không A nào là B","Có ít nhất một A không là B","Mọi B là A","Có ít nhất một B không là A"],1],
   ["“Tạm thời” gần nghĩa nhất với:",["vĩnh viễn","ngẫu nhiên","nhất thời","chắc chắn"],2],
   ["Nếu một báo cáo nói “mẫu quá nhỏ”, mối lo chính là:",["màu biểu đồ","khả năng khái quát","font chữ","tên tác giả"],1]
  ],
  2:[
   ["Hai nhóm khác nhau cả về phương pháp học và số giờ học. Điểm nhóm A cao hơn. Kết luận phù hợp nhất:",["Phương pháp A chắc chắn tốt hơn","Số giờ chắc chắn là nguyên nhân","Có biến gây nhiễu nên chưa tách được tác động","Không có khác biệt"],2],
   ["Một lập luận chỉ dựa vào 3 trường hợp cá nhân để kết luận cho cả dân số mắc lỗi chính nào?",["khái quát vội vàng","vòng tròn","đánh tráo khái niệm","mâu thuẫn nội tại"],0],
   ["“Cần” đối với “đủ” khác nhau vì:",["Điều kiện cần phải có nhưng có thể chưa bảo đảm kết quả","Điều kiện cần luôn bảo đảm kết quả","Hai khái niệm giống nhau","Điều kiện đủ không bao giờ tạo kết quả"],0]
  ],
  3:[
   ["Một nghiên cứu quan sát thấy người ngủ nhiều hơn có điểm cao hơn. Cách diễn giải tốt nhất:",["Ngủ thêm chắc chắn làm điểm cao","Có liên hệ; nhân quả cần thiết kế tốt hơn để xác lập","Điểm cao làm người ta ngủ","Không có thông tin gì"],1],
   ["Một người nói “Nếu chính sách hiệu quả, chỉ số X sẽ tăng. X tăng, vậy chính sách hiệu quả.” Lỗi là:",["phủ định tiền đề","khẳng định hậu quả","lưỡng phân giả","công kích cá nhân"],1],
   ["Hai mô hình dự đoán ngang nhau trên dữ liệu huấn luyện; A kém hơn rõ trên dữ liệu mới. Kết luận hợp lý nhất:",["A có thể overfit","A chắc chắn đơn giản hơn","B chắc chắn sai","Dữ liệu mới vô nghĩa"],0]
  ],
  4:[
   ["Lập luận: “Tất cả hệ thống ổn định đều có kiểm soát phản hồi. Hệ thống này có kiểm soát phản hồi, nên nó ổn định.” Vấn đề:",["đảo chiều điều kiện","mâu thuẫn","không dùng dữ liệu","định nghĩa vòng tròn"],0],
   ["Một chỉ số tăng sau khi quy trình mới được áp dụng, nhưng đồng thời tiêu chuẩn đo cũng thay đổi. Mối đe dọa mạnh nhất với kết luận nhân quả:",["regression to mean","thay đổi phép đo","mẫu lớn","randomization"],1],
   ["Một mô hình giải thích được mọi kết quả sau khi biết kết quả nhưng không đưa ra dự đoán có thể bác bỏ. Điểm yếu chính:",["thiếu tính kiểm chứng/falsifiability","thiếu số liệu lớn","thiếu màu sắc","thiếu độ dài"],0]
  ]
 },
 VS:{
  1:[
   ["Mũi tên ↑ quay 90° theo chiều kim đồng hồ thành:",["←","→","↓","↑"],1],
   ["Mũi tên ← phản chiếu qua trục dọc thành:",["→","↑","↓","←"],0],
   ["Điểm ở góc dưới-phải xoay 180° quanh tâm thành:",["trên-trái","trên-phải","dưới-trái","giữa"],0]
  ],
  2:[
   ["Mũi tên ↗ quay 90° ngược chiều kim đồng hồ thành:",["↖","↘","↙","↗"],0],
   ["Một vật hướng Đông, quay trái 90°, rồi quay phải 180°. Hướng cuối:",["Bắc","Nam","Đông","Tây"],1],
   ["Điểm trên-phải phản chiếu qua trục ngang rồi trục dọc thành:",["trên-trái","dưới-trái","dưới-phải","trên-phải"],1]
  ],
  3:[
   ["Một hình chữ L: từ tâm đi lên rồi sang phải. Quay 180° sẽ đi:",["xuống rồi trái","lên rồi trái","xuống rồi phải","phải rồi xuống"],0],
   ["Tờ giấy gập đôi dọc một lần; đục 2 lỗ không trên nếp. Mở ra tối đa có:",["2","3","4","8"],2],
   ["Một điểm ở (trên,trái) xoay 90° kim đồng hồ rồi phản chiếu trục dọc. Vị trí cuối:",["trên-trái","trên-phải","dưới-trái","dưới-phải"],0]
  ],
  4:[
   ["Một điểm bắt đầu trên-trái. Xoay 90° kim đồng hồ, phản chiếu trục ngang, rồi xoay 180°. Vị trí cuối:",["trên-trái","trên-phải","dưới-trái","dưới-phải"],0],
   ["Một hình vuông gập đôi dọc, gập ngang, rồi gập chéo; đục 1 lỗ không trên nếp. Khi mở hoàn toàn tối đa có:",["4","6","8","16"],2],
   ["Mũi tên ↑: phản chiếu trục chéo y=x, quay 90° kim đồng hồ, rồi phản chiếu trục dọc. Hướng cuối:",["↑","↓","←","→"],1]
  ]
 }
};
for (const d of Object.keys(A)) for (const l of Object.keys(A[d])) {
  A[d][l] = A[d][l].map((x,i)=>({id:`P2-${d}-L${l}-${i+1}`,domain:d,level:Number(l),phase:2,prompt:x[0],options:x[1],key:x[2]}));
}

const VERIFY = {
 GF:{id:"P3-GF-1",domain:"GF",phase:3,prompt:"Nếu X→Y và Y→Z, biết Z sai. Điều nào chắc chắn?",options:["X đúng","Y đúng","X sai","Không suy ra"],key:2},
 QR:{id:"P3-QR-1",domain:"QR",phase:3,prompt:"Nếu 4 phần bằng nhau có tổng 84, 3 phần bằng:",options:["42","56","63","72"],key:2},
 VC:{id:"P3-VC-1",domain:"VC",phase:3,prompt:"Một kết luận dựa trên dữ liệu tự chọn từ các trường hợp thuận lợi nhất chủ yếu có nguy cơ:",options:["selection bias","độ chính xác cao","ngẫu nhiên hóa","blinding"],key:0},
 VS:{id:"P3-VS-1",domain:"VS",phase:3,prompt:"Mũi tên ↓ quay 270° theo chiều kim đồng hồ thành:",options:["←","→","↑","↓"],key:1}
};

function phaseIntro(title, text, label) {
 return {
   type:jsPsychHtmlButtonResponse,
   stimulus:'<div class="card"><h2>'+title+'</h2><p>'+text+'</p></div>',
   choices:["Bắt đầu"],
   on_start:()=>markPhase(label||title),
   on_finish:()=>tickProgress()
 };
}

function intakeTrial() {
 const detected = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "phone/tablet" : "desktop";
 return {
   type:jsPsychSurveyHtmlForm,
   preamble:'<div class="card"><h1>Bản đồ năng lực nhận thức</h1><p>Đây là <strong>assessment nghiên cứu/tự tìm hiểu</strong>, không phải bài IQ chuẩn hóa và không dùng để chẩn đoán.</p><div class="notice warn">Không tra Google/AI, không dùng máy tính ngoài phần cho phép. Nếu bị gián đoạn, cứ ghi lại — hệ thống sẽ hạ độ chắc chắn thay vì “phán” bừa.</div></div>',
   html:`
    <label>Ngôn ngữ chính</label><select name="language"><option value="vi">Tiếng Việt</option><option value="en">English</option></select>
    <label>Thiết bị</label><select name="device"><option value="${detected}">${detected}</option><option value="phone">Điện thoại</option><option value="tablet">Tablet</option><option value="desktop">Máy tính</option></select>
    <label>Cách nhập</label><select name="input_mode"><option value="touch">Chạm</option><option value="keyboard">Bàn phím</option></select>
    <label>Mức tỉnh táo hiện tại (1–5)</label><input name="alertness" type="number" min="1" max="5" value="4" required>
    <label>Số lần gián đoạn trước khi bắt đầu</label><input name="interruptions" type="number" min="0" value="0" required>
    <label><input style="width:auto" name="external_help" type="checkbox" value="yes"> Tôi đã dùng/định dùng trợ giúp ngoài quy định</label>
    <label><input style="width:auto" name="prior_exposure" type="checkbox" value="yes"> Tôi đã từng thấy chính bộ câu hỏi này</label>`,
   button_label:"Bắt đầu",
   on_start:()=>markPhase("Phase 0 · Điều kiện làm bài"),
   on_finish:(data)=>{
     const r=data.response||{};
     state.administration={language:r.language,device:r.device,input_mode:r.input_mode,alertness_1_5:Number(r.alertness),interruptions:Number(r.interruptions||0),external_help:r.external_help==="yes",prior_exposure:r.prior_exposure==="yes",user_agent:navigator.userAgent,screen:[screen.width,screen.height]};
     if(state.administration.external_help) state.integrity.push("EXTERNAL_HELP_DECLARED");
     if(state.administration.prior_exposure) state.integrity.push("PRIOR_EXPOSURE");
     tickProgress();
   }
 };
}

function lrEncoding() {
 const pairs=[["Luma","cầu"],["Neri","lá"],["Savo","đá"],["Kito","mây"],["Pera","đèn"],["Vumi","sông"],["Daro","khóa"],["Tebi","gương"]];
 return showTimed('<div class="card"><h2>Ghi nhớ các cặp</h2><div class="pair-grid">'+pairs.map(p=>'<div class="pair">'+p[0]+' — '+p[1]+'</div>').join("")+'</div><p class="small">Danh sách sẽ tự ẩn. Không ghi chép.</p></div>',45000,"Phase 1 · Learning / Retrieval",()=>{state.lr_encoded_at=Date.now();});
}
const LRMAP={Luma:"cầu",Neri:"lá",Savo:"đá",Kito:"mây",Pera:"đèn",Vumi:"sông",Daro:"khóa",Tebi:"gương"};
function lrRecall(id,cues,delayed=false) {
 return {
  type:jsPsychSurveyHtmlForm,
  preamble:'<div class="card"><h2>'+(delayed?'Nhớ lại trì hoãn':'Nhớ lại ngay')+'</h2><p>Nhập từ ghép với từng từ gợi ý.</p></div>',
  html:cues.map(c=>'<label>'+c+'</label><input name="'+c+'" type="text" autocomplete="off" required>').join(""),
  button_label:"Xác nhận",
  on_start:()=>markPhase("Phase 1 · Learning / Retrieval"),
  on_finish:(data)=>{
    const elapsed=state.lr_encoded_at?Date.now()-state.lr_encoded_at:null;
    cues.forEach(c=>{
      const ans=String(data.response?.[c]||"").trim().toLowerCase();
      const key=LRMAP[c];
      record({item_id:id+"-"+c,phase:1,domain:"LR",prompt:"Cue: "+c,answer:ans,key,score:ans===key?1:0,rt_ms:data.rt,flags:delayed&&elapsed<18*60*1000?["DELAY_LT_18_MIN"]:[]});
    });
    if(delayed&&elapsed<18*60*1000) state.integrity.push("LR_DELAY_SHORT");
    tickProgress();
  }
 };
}

function wmTimeline() {
 const t=[];
 t.push(showTimed('<div class="card"><h2>Working memory</h2><p class="small">Nhìn chuỗi, sau đó chuỗi sẽ ẩn.</p><div class="stimulus">7 · 2 · 9 · 4 · 1</div></div>',6000,"Phase 1 · Working Memory"));
 t.push(textRecall({id:"WM1",domain:"WM",prompt:"Nhập lại chuỗi vừa thấy theo thứ tự ngược.",key:"14927"},"Phase 1 · Working Memory"));
 t.push(confidenceTrial("Phase 1 · Working Memory"));
 t.push(showTimed('<div class="card"><div class="stimulus">B · 7 · A · 2 · D · 5</div><p class="small">Ghi nhớ, không ghi chép.</p></div>',8000,"Phase 1 · Working Memory"));
 t.push(textRecall({id:"WM2",domain:"WM",prompt:"Nhập các số tăng dần trước, rồi chữ cái theo alphabet. Ví dụ: 257ABD",key:"257ABD"},"Phase 1 · Working Memory"));
 t.push(confidenceTrial("Phase 1 · Working Memory"));
 t.push(showTimed('<div class="card"><div class="stimulus">K · M · K · T · M · T</div><p class="small">Tìm vị trí giống ký hiệu cách nó 2 vị trí trước.</p></div>',9000,"Phase 1 · Working Memory"));
 t.push(textRecall({id:"WM3",domain:"WM",prompt:"Nhập các vị trí, cách nhau bằng dấu phẩy.",key:["3,6","36"]},"Phase 1 · Working Memory"));
 t.push(confidenceTrial("Phase 1 · Working Memory"));
 ["Bắt đầu: 18","+ 7","− 4","× 2","− 10"].forEach(x=>t.push(showTimed('<div class="card"><div class="stimulus">'+x+'</div></div>',2000,"Phase 1 · Working Memory")));
 t.push(textRecall({id:"WM4",domain:"WM",prompt:"Giá trị cuối cùng là?",key:"32"},"Phase 1 · Working Memory"));
 t.push(confidenceTrial("Phase 1 · Working Memory"));
 return t;
}

const PS_PAIRS=[
 ["K7M2Q","K7M2Q",0],["4P8LX","4P8XL",1],["N3R6T","N3R6T",0],["8Q2VA","8Q2AV",1],
 ["B7K91","B7K91",0],["T5M3C","T5N3C",1],["2L8PX","2L8PX",0],["R4Q7D","R4Q7O",1],
 ["H9V2K","H9V2K",0],["6C3MT","6C8MT",1],["P2R5A","P2R5A",0],["X7L4N","X7L4M",1],
 ["3Q9BC","3Q9BC",0],["M5T2R","M5T2R",0],["V8P4K","V8P4X",1],["D2N7S","D2N7S",0]
];
function psTimeline() {
 const t=[phaseIntro("Processing speed","Mỗi cặp chỉ có tối đa 2.5 giây. Chọn GIỐNG nếu hoàn toàn giống, KHÁC nếu có bất kỳ khác biệt nào.","Phase 1 · Processing Speed")];
 PS_PAIRS.forEach((p,i)=>{
  t.push({
   type:jsPsychHtmlButtonResponse,
   stimulus:'<div class="stimulus"><span>'+p[0]+'</span><br><span>'+p[1]+'</span></div>',
   choices:["GIỐNG","KHÁC"],trial_duration:2500,
   on_start:()=>markPhase("Phase 1 · Processing Speed"),
   on_finish:(data)=>{
    record({item_id:"PS1-"+(i+1),phase:1,domain:"PS",prompt:p[0]+" / "+p[1],answer:data.response===null?null:["GIỐNG","KHÁC"][data.response],key:["GIỐNG","KHÁC"][p[2]],score:data.response===p[2]?1:0,rt_ms:data.rt,flags:data.response===null?["TIMEOUT"]:[]});
    tickProgress();
   }
  });
 });
 return t;
}

const SUPP=[
 {id:"SR1",domain:"SR",prompt:"Hai đồng nghiệp tranh cãi vì deadline trễ. Hành động thu thập thông tin tốt nhất trước khi kết luận?",options:["Chọn người thâm niên hơn.","Hỏi riêng từng người về timeline, trách nhiệm, bằng chứng và handoff.","Yêu cầu cả hai xin lỗi ngay.","Người phản ứng mạnh hơn là người sai."],key:1},
 {id:"ER1",domain:"ER",prompt:"Sau feedback, một đồng nghiệp trả lời ngắn hơn bình thường. Kết luận hợp lý nhất?",options:["Chắc chắn họ tức giận.","Chắc chắn họ mất động lực.","Có nhiều khả năng; cần thêm dữ liệu trước khi suy ra cảm xúc.","Không thể có cảm xúc nào liên quan."],key:2},
 {id:"PD1",domain:"PD",prompt:"Một phương án có upside lớn nhưng dữ liệu nền rất ít. Phản ứng tốt nhất?",options:["Chọn ngay.","Loại ngay.","Tách quyết định có thể đảo ngược/không đảo ngược, lấy thêm dữ liệu giá trị cao và đặt ngưỡng dừng.","Theo số đông."],key:2}
];
function creativityTrial(){
 return {
  type:jsPsychSurveyHtmlForm,
  preamble:'<div class="card"><h2>Creativity · divergent thinking</h2><p>Trong 2 phút, liệt kê càng nhiều cách dùng hợp lý cho một chiếc kẹp giấy càng tốt. Không cần cố “đẹp”; ưu tiên ý khác nhau.</p></div>',
  html:'<label for="cr">Các cách dùng</label><textarea id="cr" name="answer" rows="8" required></textarea>',
  button_label:"Lưu câu trả lời",
  on_start:()=>markPhase("Supplemental · Creativity"),
  on_finish:(data)=>{
    record({item_id:"CR1",phase:1,domain:"CR",prompt:"Các cách dùng hợp lý cho một chiếc kẹp giấy",answer:String(data.response?.answer||""),key:"Rubric tách fluency/flexibility; originality chưa norm",score:null,rt_ms:data.rt,flags:["OPEN_RUBRIC"]});
    tickProgress();
  }
 };
}

function computeP1(resetAdaptive=true) {
 ["GF","QR","VC","VS","WM","PS","LR"].forEach(d=>{
   const rs=state.responses.filter(r=>r.phase===1&&r.domain===d&&r.score!==null);
   const correct=rs.reduce((a,b)=>a+(b.score||0),0);
   state.phase1[d]={valid:rs.length,correct,accuracy:rs.length?correct/rs.length:null};
 });
 if(resetAdaptive){
  ["GF","QR","VC","VS"].forEach(d=>{
    const a=state.phase1[d].accuracy;
    const level=a===null?2:(a<.40?1:a<.70?2:a<.90?3:4);
    state.adaptive[d]={level,items:0,results:{1:[],2:[],3:[],4:[]},outcomes:{},done:false,stop_reason:null,start_level:level};
  });
 }
 persist();
}
function settleAdaptive(d,level,outcome) {
 const s=state.adaptive[d]; s.outcomes[level]=outcome;
 if(outcome==="pass"){
   if(level===4){s.done=true;s.stop_reason="CEILING_L4";return;}
   if(s.outcomes[level+1]==="fail"){s.done=true;s.stop_reason="BRACKET";return;}
   s.level=level+1;
 } else {
   if(level===1){s.done=true;s.stop_reason="FLOOR_L1";return;}
   if(s.outcomes[level-1]==="pass"){s.done=true;s.stop_reason="BRACKET";return;}
   s.level=level-1;
 }
}
function updateAdaptive(d,correct) {
 const s=state.adaptive[d], level=s.level;
 s.items++; s.results[level].push(correct?1:0);
 const arr=s.results[level];
 if(arr.length===2){
  const sum=arr[0]+arr[1];
  if(sum===2) settleAdaptive(d,level,"pass");
  else if(sum===0) settleAdaptive(d,level,"fail");
 } else if(arr.length===3){
  settleAdaptive(d,level,arr.reduce((a,b)=>a+b,0)>=2?"pass":"fail");
 }
 if(s.items>=8&&!s.done){s.done=true;s.stop_reason="MAX_ITEMS";}
 state.phase2_trace.push({domain:d,item_count:s.items,level,correct:!!correct,next_level:s.level,stop_reason:s.stop_reason});
 persist();
}
function nextAdaptiveItem(d) {
 const s=state.adaptive[d], arr=s.results[s.level];
 return A[d][s.level][Math.min(arr.length,2)];
}
function adaptiveSlot(d,slot) {
 let activeItem=null;
 return {
   timeline:[{
    type:jsPsychHtmlButtonResponse,
    stimulus:"",
    choices:[],
    on_start:(trial)=>{
      activeItem=nextAdaptiveItem(d);
      trial.stimulus='<div class="badge">Phase 2 · '+d+' · L'+activeItem.level+'</div><div class="question">'+activeItem.prompt+'</div>';
      trial.choices=activeItem.options;
      markPhase("Phase 2 · Adaptive "+d);
    },
    on_finish:(data)=>{
      const ok=data.response===activeItem.key;
      record({item_id:activeItem.id,phase:2,domain:d,prompt:activeItem.prompt,answer:data.response===null?null:activeItem.options[data.response],key:activeItem.options[activeItem.key],score:ok?1:0,rt_ms:data.rt,level:activeItem.level,flags:data.response===null?["NO_RESPONSE"]:[]});
      updateAdaptive(d,ok); tickProgress();
      state._lastAdaptiveSlot=d+"-"+slot;
    }
   },{
    type:jsPsychSurveyHtmlForm,
    preamble:'<div class="subq">Mức chắc chắn về câu vừa trả lời</div>',
    html:'<div class="range-row"><input id="cf" name="confidence" type="range" min="0" max="100" value="70" oninput="document.getElementById(\'cfv\').value=this.value"><output id="cfv">70</output></div>',
    button_label:"Tiếp tục",
    on_finish:(data)=>{if(state.lastResponseIndex!==null)state.responses[state.lastResponseIndex].confidence=Number(data.response.confidence);tickProgress();}
   }],
   conditional_function:()=>!!state.adaptive[d]&&!state.adaptive[d].done
 };
}

function preparePhase3() {
 state.phase3Domains=[];
 ["GF","QR","VC","VS"].forEach(d=>{
  const p=state.phase1[d]?.accuracy, a=state.adaptive[d];
  const highPass=Object.entries(a?.outcomes||{}).some(([l,o])=>Number(l)>=3&&o==="pass");
  const lowFail=Object.entries(a?.outcomes||{}).some(([l,o])=>Number(l)<=2&&o==="fail");
  if((p!==null&&p>=.75&&lowFail)||(p!==null&&p<=.25&&highPass)||a?.stop_reason==="MAX_ITEMS"){
    state.phase3Domains.push(d); state.phase3_flags.push("RECONCILE_"+d);
  }
 });
 if(state.administration.interruptions>=3) state.integrity.push("MULTIPLE_INTERRUPTS");
 persist();
}
function p3Trial(d) {
 return {
  timeline:[mcTrial(VERIFY[d],"Phase 3 · Xác minh"),confidenceTrial("Phase 3 · Xác minh")],
  conditional_function:()=>state.phase3Domains.includes(d)
 };
}

function brier() {
 const rs=state.responses.filter(r=>r.score!==null&&r.confidence!==null);
 if(!rs.length)return null;
 return rs.reduce((s,r)=>s+Math.pow(r.confidence/100-r.score,2),0)/rs.length;
}
function conclusionConfidence(d) {
 const rs=state.responses.filter(r=>r.domain===d&&r.score!==null);
 const levels=new Set(rs.filter(r=>r.level).map(r=>r.level));
 const caveat=rs.some(r=>r.flags?.length)||state.integrity.length;
 if(rs.length>=5&&levels.size>=2&&!caveat)return "HIGH";
 if(rs.length>=3&&(levels.size>=2||rs.some(r=>r.phase===3)))return "MODERATE";
 if(rs.length>=3)return "LOW";
 return "INSUFFICIENT";
}
function adaptiveSummary(d) {
 const a=state.adaptive[d]; if(!a)return "Không áp dụng";
 const pass=Object.keys(a.outcomes).filter(l=>a.outcomes[l]==="pass").map(Number).sort((x,y)=>x-y);
 const fail=Object.keys(a.outcomes).filter(l=>a.outcomes[l]==="fail").map(Number).sort((x,y)=>x-y);
 if(a.stop_reason==="CEILING_L4")return "Pass L4 · chạm trần protocol";
 if(a.stop_reason==="FLOOR_L1")return "Fail L1 · chạm sàn protocol";
 for(const p of pass){if(fail.includes(p+1))return "Bracket L"+p+"–L"+(p+1);}
 return (pass.length?"Pass: "+pass.map(x=>"L"+x).join(", "):"Chưa có level pass")+(fail.length?" · Fail: "+fail.map(x=>"L"+x).join(", "):"")+" · "+(a.stop_reason||"");
}
function scorePct(d,phase=1) {
 const rs=state.responses.filter(r=>r.domain===d&&r.phase===phase&&r.score!==null);
 return rs.length?Math.round(100*rs.reduce((a,b)=>a+b.score,0)/rs.length):null;
}
function buildBundle() {
 const summary={};
 ["GF","QR","VC","VS","WM","PS","LR"].forEach(d=>summary[d]={phase1_accuracy:state.phase1[d]?.accuracy??null,phase2:adaptiveSummary(d),confidence:conclusionConfidence(d)});
 return {
  schema_version:"CAA-1.0",
  app_version:VERSION,
  scoring_contract_version:SCORING_VERSION,
  router_version:ROUTER_VERSION,
  evaluator_contract_version:EVALUATOR_VERSION,
  session_id:state.session_id,
  started_at:state.started_at,
  finished_at:new Date().toISOString(),
  administration:state.administration,
  integrity_flags:[...new Set(state.integrity)],
  responses:state.responses,
  phase2_trace:state.phase2_trace,
  phase3_flags:state.phase3_flags,
  deterministic_summary:summary,
  metacognition:{brier:brier()},
  interpretation_limits:["Không phải test IQ chuẩn hóa","Không phát percentile/top-x%","Không chẩn đoán lâm sàng","Không so raw score khác miền như cùng thang đo"]
 };
}
async function sha256(text) {
 const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function mdReport(bundle,checksum) {
 const lines=[
  "# Cognitive Assessment Report",
  "",
  "- Session: "+bundle.session_id,
  "- App: "+bundle.app_version,
  "- Integrity: "+(bundle.integrity_flags.length?bundle.integrity_flags.join(", "):"không có flag lớn"),
  "- Brier calibration: "+(bundle.metacognition.brier===null?"n/a":bundle.metacognition.brier.toFixed(3)),
  "- SHA-256: "+checksum,
  "",
  "## Core evidence"
 ];
 ["GF","QR","VC","VS","WM","PS","LR"].forEach(d=>{
  const s=bundle.deterministic_summary[d];
  lines.push("- **"+d+"** — Phase 1: "+(s.phase1_accuracy===null?"n/a":Math.round(s.phase1_accuracy*100)+"%")+"; Adaptive: "+s.phase2+"; conclusion confidence: "+s.confidence);
 });
 lines.push("","## Giới hạn diễn giải",...bundle.interpretation_limits.map(x=>"- "+x));
 lines.push("","## Phase 3 flags",bundle.phase3_flags.length?bundle.phase3_flags.join(", "):"Không kích hoạt");
 return lines.join("\n");
}
async function renderReport() {
 markPhase("Hoàn tất");
 $("#progress-label").textContent="100%";$("#progress-fill").style.width="100%";
 computeP1(false);
 const bundle=buildBundle();
 const checksum=await sha256(JSON.stringify(bundle));
 bundle.checksum_sha256=checksum;
 const md=mdReport(bundle,checksum);
 const rows=["GF","QR","VC","VS","WM","PS","LR"].map(d=>{
   const s=bundle.deterministic_summary[d], p=s.phase1_accuracy;
   const badge=s.confidence==="HIGH"?"ok":s.confidence==="MODERATE"?"warn":"bad";
   return '<div class="metric"><div><strong>'+d+'</strong><div class="small">'+(p===null?"P1 n/a":"P1 "+Math.round(p*100)+"%")+' · '+esc(s.phase2)+'</div></div><span class="badge '+badge+'">'+s.confidence+'</span></div>';
 }).join("");
 const integrity=bundle.integrity_flags.length?'<div class="notice warn">'+bundle.integrity_flags.map(esc).join(" · ")+'</div>':'<div class="notice ok">Không có integrity flag lớn được phát hiện.</div>';
 const suppRows=["SR","ER","PD"].map(d=>{
   const r=state.responses.find(x=>x.domain===d);
   return '<div class="metric"><div><strong>'+d+'</strong><div class="small">'+(r?esc(r.item_id):"n/a")+'</div></div><span class="badge '+(r&&r.score===1?"ok":"warn")+'">'+(r?(r.score===1?"phù hợp key protocol":"cần xem lại evidence"):"n/a")+'</span></div>';
 }).join("")+'<div class="metric"><div><strong>CR</strong><div class="small">Divergent-thinking sample</div></div><span class="badge">'+(state.responses.some(x=>x.domain==="CR")?"đã thu thập":"n/a")+'</span></div>';
 document.getElementById("app-shell").innerHTML='<main class="report"><section><div class="eyebrow">CAA-1.0 · SESSION '+esc(bundle.session_id.slice(0,8))+'</div><h1>Đã hoàn tất</h1><p>Kết quả dưới đây là <strong>evidence trong session</strong>, không phải IQ/percentile chuẩn hóa.</p>'+integrity+'</section><section><h2>Core evidence</h2>'+rows+'</section><section><h2>Supplemental</h2><p class="small">Tách khỏi general intelligence; không dùng để suy ra tính cách.</p>'+suppRows+'</section><section><h2>Metacognition</h2><p>Brier score trong session: <strong>'+(bundle.metacognition.brier===null?"n/a":bundle.metacognition.brier.toFixed(3))+'</strong>. Thấp hơn nghĩa là confidence gần đúng/sai thực tế hơn trong chính session này; không so với dân số.</p></section><section><h2>Phase 3</h2><p>'+(bundle.phase3_flags.length?esc(bundle.phase3_flags.join(", ")):"Không cần mở phase xác minh bổ sung theo rule hiện tại.")+'</p></section><section><h2>Giới hạn bắt buộc</h2><ul>'+bundle.interpretation_limits.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul><p class="small">Checksum: '+checksum+'</p></section><div class="actions"><button class="primary" id="copy-ai">Copy AI Bundle</button><button class="secondary" id="copy-qa">Copy full Q&A</button><button class="secondary" id="dl-json">Export JSON</button><button class="secondary" id="dl-md">Export Markdown</button><button class="secondary" id="print">In / Save PDF</button><button class="danger" id="restart">Làm phiên mới</button></div></main>';
 const evaluatorPrompt="Bạn là evaluator thứ hai. Không thay đổi deterministic score. Đọc Assessment Bundle theo SC-1.0; kiểm tra scoring, adaptive trace, integrity và evidence trước khi diễn giải. Mỗi kết luận phải trích item IDs. Không phát IQ/percentile/top-x% hay chẩn đoán. Nêu rõ chỗ chắc chắn, mâu thuẫn, alternative explanations và khuyến nghị.\n\nASSESSMENT BUNDLE:\n"+JSON.stringify(bundle,null,2);
 $("#copy-ai").onclick=()=>navigator.clipboard.writeText(evaluatorPrompt).then(()=>alert("Đã copy AI Bundle"));
 $("#copy-qa").onclick=()=>navigator.clipboard.writeText(state.responses.map(r=>`[${r.item_id}] Q: ${r.prompt}\nA: ${r.answer}\nKey: ${r.key}\nScore: ${r.score} · RT: ${r.rt_ms}ms · Confidence: ${r.confidence}\n`).join("\n")).then(()=>alert("Đã copy full Q&A"));
 $("#dl-json").onclick=()=>download("cognitive-"+state.session_id+".json",JSON.stringify(bundle,null,2),"application/json");
 $("#dl-md").onclick=()=>download("cognitive-"+state.session_id+".md",md,"text/markdown");
 $("#print").onclick=()=>window.print();
 $("#restart").onclick=()=>{localStorage.removeItem("caa-last-session");location.href=location.pathname;};
 localStorage.setItem("caa-completed-"+state.session_id,JSON.stringify(bundle));
}
function download(name,content,type){
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function selfTest() {
 const tests=[];
 const assert=(name,cond)=>tests.push({name,pass:!!cond});
 [0,.39,.40,.69,.70,.89,.90,1].forEach(a=>{
   const level=a<.40?1:a<.70?2:a<.90?3:4;
   assert("router "+a+" -> L"+level,[1,2,3,4].includes(level));
 });
 state.adaptive.T={level:2,items:0,results:{1:[],2:[],3:[],4:[]},outcomes:{},done:false,start_level:2};
 updateAdaptive("T",true);updateAdaptive("T",true);
 assert("adaptive 2/2 pass moves up",state.adaptive.T.level===3);
 updateAdaptive("T",false);updateAdaptive("T",false);
 assert("adaptive fail after lower pass brackets",state.adaptive.T.done&&state.adaptive.T.stop_reason==="BRACKET");
 const ok=tests.every(t=>t.pass);
 document.getElementById("app-shell").innerHTML='<main class="report"><section><h1>Self-test '+(ok?"PASS":"FAIL")+'</h1>'+tests.map(t=>'<div class="metric"><span>'+esc(t.name)+'</span><span class="badge '+(t.pass?"ok":"bad")+'">'+(t.pass?"PASS":"FAIL")+'</span></div>').join("")+'<p class="small">App '+VERSION+'</p></section></main>';
 document.title="CAA Self-test "+(ok?"PASS":"FAIL");
}

if(new URLSearchParams(location.search).get("selftest")==="1"){ selfTest(); return; }

if(typeof initJsPsych!=="function"){
 document.getElementById("jspsych-target").innerHTML='<div class="card"><h2>Không tải được jsPsych</h2><p>Kiểm tra kết nối mạng rồi tải lại trang.</p></div>';return;
}

const jsPsych=initJsPsych({display_element:"jspsych-target",on_finish:renderReport});
const timeline=[];
timeline.push(intakeTrial());
timeline.push(lrEncoding());
timeline.push(phaseIntro("Phase 1 · Broad screening","Cùng một core item set cho mọi người. Không hiện đúng/sai trong lúc làm.","Phase 1 · Broad screening"));

["GF","QR"].forEach(d=>P1[d].forEach(q=>{timeline.push(mcTrial(q,"Phase 1 · "+d));timeline.push(confidenceTrial("Phase 1 · "+d));}));
timeline.push(lrRecall("LR1",["Luma","Savo","Pera","Daro"],false));
["VC","VS"].forEach(d=>P1[d].forEach(q=>{timeline.push(mcTrial(q,"Phase 1 · "+d));timeline.push(confidenceTrial("Phase 1 · "+d));}));
timeline.push(...wmTimeline());
timeline.push(...psTimeline());

timeline.push(phaseIntro("Supplemental","Các câu sau được báo cáo riêng, không gộp thành “general intelligence”.","Supplemental"));
SUPP.forEach(q=>{timeline.push(mcTrial(q,"Supplemental"));timeline.push(confidenceTrial("Supplemental"));});
timeline.push(creativityTrial());
timeline.push({
 type:jsPsychHtmlButtonResponse,
 stimulus:'<div class="card"><h2>Chuẩn bị Phase 2</h2><p>Hệ thống sẽ route độ khó theo Phase 1. Không có điểm IQ/percentile nào được tạo ở bước này.</p></div>',
 choices:["Tiếp tục"],
 on_start:()=>{computeP1();markPhase("Routing · AR-1.0");},
 on_finish:()=>tickProgress()
});
["GF","QR","VC","VS"].forEach(d=>{
 timeline.push(phaseIntro("Adaptive "+d,"Bắt đầu ở level được chọn từ Phase 1. 2/2 đúng sẽ tăng level; 0/2 giảm; 1/2 có tie-breaker. Dừng khi bracket hoặc tối đa 8 item.","Phase 2 · Adaptive "+d));
 for(let i=0;i<8;i++)timeline.push(adaptiveSlot(d,i));
});
timeline.push(lrRecall("LR2",["Luma","Neri","Savo","Kito","Pera","Vumi","Daro","Tebi"],true));
timeline.push({
 type:jsPsychHtmlButtonResponse,
 stimulus:'<div class="card"><h2>Kiểm tra consistency</h2><p>Nếu Phase 1 và Phase 2 mâu thuẫn theo rule, hệ thống sẽ thêm một số câu xác minh. Nếu không, sẽ đi thẳng tới report.</p></div>',
 choices:["Tiếp tục"],
 on_start:()=>{preparePhase3();markPhase("Phase 3 · Reconciliation");},
 on_finish:()=>tickProgress()
});
["GF","QR","VC","VS"].forEach(d=>timeline.push(p3Trial(d)));
timeline.push({
 type:jsPsychHtmlButtonResponse,
 stimulus:'<div class="card"><h2>Hoàn tất</h2><p>Hệ thống sẽ tạo deterministic summary, raw bundle và các nút export/copy cho AI đối chiếu.</p></div>',
 choices:["Tạo báo cáo"],
 on_start:()=>markPhase("Scoring · SC-1.0"),
 on_finish:()=>tickProgress()
});
jsPsych.run(timeline);

})();