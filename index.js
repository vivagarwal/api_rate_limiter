const express = require("express");
const ratelimiter = require("./rate_limiter1")

const app = express();
const PORT = process.env.PORT || 8080;

app.use(ratelimiter)

app.get("/", (req, res) => {
    res.status(200).json({ message: `Welcome to API RATE LIMITER` });
});

app.get("/ping",async(req,res)=>{
    res.status(200).json({message:"Pinged to server"})
})

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});