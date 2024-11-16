const User=require("../models/userSchema")


const userAuth = (req, res, next) => {
    console.log('Session user:', req.session.user);  // Check if the session user is present
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    req.user = data;  // Attach user to the request
                    next();
                } else {
                    console.log("User is blocked or doesn't exist", req.session.user);
                    res.redirect("/login");
                }
            })
            .catch(error => {
                console.log("Error in User auth middleware", error);
                res.status(500).send("Internal server error");
            });
    } else {
        console.log("No session user, redirecting to login");
        res.redirect("/login");
    }
};



const adminAuth=(req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("error in admin auth middleware");
        res.status(500).send("Internal Server Error")
        
    })
}

module.exports={
    userAuth,
    adminAuth
}