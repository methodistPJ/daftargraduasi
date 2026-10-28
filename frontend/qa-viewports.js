document.querySelector('#viewport').addEventListener('change',e=>{document.body.className=e.target.value==='768'?'tablet':e.target.value==='1440'?'desktop':'';});
