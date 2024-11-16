const express=require("express")
const env=require("dotenv").config()

const path=require("path")
const session=require("express-session")
const passport=require("./config/passport")
const multer = require('multer')


const db=require("./config/db")
const userRouter=require("./routes/userRouter")
const adminRouter=require ("./routes/adminRouter")
db()

const app=express()

app.use(express.json())
app.use(express.urlencoded({extended:true}))

app.use(session({
    secret:"scarface",
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        sameSite:'strict',
        maxAge:60*1000*60
    }
}))

app.use(passport.initialize())
app.use(passport.session())



app.set("view engine","ejs")
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")])
app.use(express.static(path.join(__dirname, '/design')));



app.use("/",userRouter)
app.use("/admin",adminRouter)

app.listen(process.env.PORT,()=>{
    console.log("server running");
    
})



module.exports=app 