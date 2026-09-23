const express = require('express');
const {authenticateHospitalAdmin} = require('../middleware/auth.middleware');
const Fap = require('../models/hospital-fap.model');
const router = express.Router();
router.use('/hospital/fap',authenticateHospitalAdmin);
const handle=fn=>(req,res,next)=>{try{fn(req,res);}catch(error){next(error);}};
router.get('/hospital/fap/summary',handle((req,res)=>res.json(Fap.summary(req.hospitalId))));
router.get('/hospital/fap/options',handle((req,res)=>res.json(Fap.options(req.hospitalId))));
router.get('/hospital/fap/patients',handle((req,res)=>{
 const {search='',student_id,university_id,condition}=req.query;
 const limit=Number(req.query.limit ?? 25),offset=Number(req.query.offset ?? 0);
 if(typeof search!=='string'||search.length>200||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0
  ||[student_id,university_id].some(v=>v!==undefined&&v!==''&&(!/^\d+$/.test(v)||Number(v)<1))
  ||(condition&&!['HTN','DM','Anaemia','Pediatric','NoFollowUp'].includes(condition)))return res.status(400).json({error:'Invalid patient search or pagination parameters.'});
 res.json(Fap.list(req.hospitalId,{search,student_id,university_id,condition,limit,offset}));
}));
router.get('/hospital/fap/patients/:id',handle((req,res)=>{
 if(!/^\d+$/.test(req.params.id))return res.status(400).json({error:'Invalid FAP record ID.'});
 const dossier=Fap.dossier(req.hospitalId,Number(req.params.id));
 if(!dossier)return res.status(404).json({error:'FAP record not found for this hospital.'});
 res.json(dossier);
}));
module.exports=router;
