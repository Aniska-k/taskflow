import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {createServer} from "http";
import {Server} from "socket.io";

const __filename=fileURLToPath(import.meta.url), __dirname=path.dirname(__filename);
const dataDir=path.join(__dirname,"data"), dataFile=path.join(dataDir,"data.json");
fs.mkdirSync(dataDir,{recursive:true});
const now=()=>new Date().toISOString();
const initial=()=>({nextUserId:2,nextTaskId:4,users:[{id:1,name:"Demo User",email:"demo@taskflow.local",passwordHash:bcrypt.hashSync("Demo@12345",10),role:"user",createdAt:now()}],tasks:[
{id:1,userId:1,title:"Finish React UI",description:"Complete the responsive task dashboard.",dueDate:"2026-09-23",priority:"High",status:"Pending",createdAt:now(),updatedAt:now()},
{id:2,userId:1,title:"Connect REST API",description:"Verify create, update and delete operations.",dueDate:"2026-09-24",priority:"High",status:"Completed",createdAt:now(),updatedAt:now()},
{id:3,userId:1,title:"Prepare assignment demo",description:"Show authentication, CRUD and progress tracking.",dueDate:"2026-09-25",priority:"Medium",status:"Pending",createdAt:now(),updatedAt:now()}]});
let db;
try{db=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,"utf8")):initial();}catch{db=initial();}
function save(){fs.writeFileSync(dataFile,JSON.stringify(db,null,2))}
if(!fs.existsSync(dataFile))save();
const app=express(), server=createServer(app), io=new Server(server,{cors:{origin:true}});
const PORT=5001, SECRET="taskflow-secret-change-before-production";
app.use(cors({origin:true})); app.use(express.json());
const safe=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
const tok=u=>jwt.sign({id:u.id,email:u.email,role:u.role},SECRET,{expiresIn:"7d"});
function auth(req,res,next){const h=req.headers.authorization||"";if(!h.startsWith("Bearer "))return res.status(401).json({message:"Authentication required."});try{req.user=jwt.verify(h.slice(7),SECRET);next()}catch{res.status(401).json({message:"Session expired. Please log in again."})}}
const out=t=>({id:t.id,title:t.title,description:t.description,dueDate:t.dueDate,priority:t.priority,status:t.status,createdAt:t.createdAt,updatedAt:t.updatedAt});
const changed=id=>io.to("user:"+id).emit("tasks:changed");

app.get("/api/health",(q,r)=>r.json({ok:true,service:"TaskFlow API"}));
app.post("/api/auth/register",async(req,res)=>{try{
 const name=String(req.body.name||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||"");
 if(!name||!email||!password)return res.status(400).json({message:"Name, email and password are required."});
 if(password.length<6)return res.status(400).json({message:"Password must contain at least 6 characters."});
 if(db.users.some(u=>u.email===email))return res.status(409).json({message:"Email is already registered. Try logging in."});
 const u={id:db.nextUserId++,name,email,passwordHash:await bcrypt.hash(password,10),role:"user",createdAt:now()};db.users.push(u);save();res.status(201).json({token:tok(u),user:safe(u)});
}catch(e){console.error(e);res.status(500).json({message:"Registration failed on the server."})}});
app.post("/api/auth/login",async(req,res)=>{try{
 const email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||""),u=db.users.find(x=>x.email===email);
 if(!u||!(await bcrypt.compare(password,u.passwordHash)))return res.status(401).json({message:"Incorrect email or password."});
 res.json({token:tok(u),user:safe(u)});
}catch(e){res.status(500).json({message:"Login failed on the server."})}});
app.get("/api/auth/me",auth,(req,res)=>{const u=db.users.find(x=>x.id===req.user.id);u?res.json({user:safe(u)}):res.status(404).json({message:"User not found."})});

app.get("/api/tasks",auth,(req,res)=>{let a=db.tasks.filter(t=>t.userId===req.user.id);const{status,priority,search}=req.query;
 if(status&&status!=="All")a=a.filter(t=>t.status===status);if(priority&&priority!=="All")a=a.filter(t=>t.priority===priority);
 if(search){const q=search.toLowerCase();a=a.filter(t=>(t.title+" "+t.description).toLowerCase().includes(q))}
 const rank={High:1,Medium:2,Low:3};a.sort((x,y)=>rank[x.priority]-rank[y.priority]||(x.dueDate||"9999").localeCompare(y.dueDate||"9999")||y.id-x.id);res.json({tasks:a.map(out)})});
app.get("/api/tasks/stats",auth,(req,res)=>{const a=db.tasks.filter(t=>t.userId===req.user.id),c=a.filter(t=>t.status==="Completed").length;res.json({total:a.length,completed:c,pending:a.length-c,highPriority:a.filter(t=>t.priority==="High"&&t.status==="Pending").length,progress:a.length?Math.round(c/a.length*100):0})});
app.post("/api/tasks",auth,(req,res)=>{const title=String(req.body.title||"").trim();if(!title)return res.status(400).json({message:"Task title is required."});const t={id:db.nextTaskId++,userId:req.user.id,title,description:String(req.body.description||"").trim(),dueDate:req.body.dueDate||null,priority:req.body.priority||"Medium",status:"Pending",createdAt:now(),updatedAt:now()};db.tasks.push(t);save();changed(req.user.id);res.status(201).json({task:out(t)})});
app.put("/api/tasks/:id",auth,(req,res)=>{const t=db.tasks.find(x=>x.id==req.params.id&&x.userId===req.user.id);if(!t)return res.status(404).json({message:"Task not found."});t.title=String(req.body.title??t.title).trim();t.description=String(req.body.description??t.description).trim();t.dueDate=req.body.dueDate||null;t.priority=req.body.priority||t.priority;t.status=req.body.status||t.status;t.updatedAt=now();save();changed(req.user.id);res.json({task:out(t)})});
app.patch("/api/tasks/:id/toggle",auth,(req,res)=>{const t=db.tasks.find(x=>x.id==req.params.id&&x.userId===req.user.id);if(!t)return res.status(404).json({message:"Task not found."});t.status=t.status==="Completed"?"Pending":"Completed";t.updatedAt=now();save();changed(req.user.id);res.json({task:out(t)})});
app.delete("/api/tasks/:id",auth,(req,res)=>{const n=db.tasks.length;db.tasks=db.tasks.filter(t=>!(t.id==req.params.id&&t.userId===req.user.id));if(n===db.tasks.length)return res.status(404).json({message:"Task not found."});save();changed(req.user.id);res.json({message:"Task deleted."})});
app.delete("/api/tasks",auth,(req,res)=>{db.tasks=db.tasks.filter(t=>t.userId!==req.user.id);save();changed(req.user.id);res.json({message:"All tasks deleted."})});
io.on("connection",s=>s.on("join:user",id=>s.join("user:"+Number(id))));
server.listen(PORT,()=>console.log(`TaskFlow API running on http://localhost:${PORT}`));