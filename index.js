require('dotenv').config(); 
const express = require('express');
const router = express.Router();
const app = express();
const over = require('method-override');
const mongoose = require('mongoose');
const mongoConnect = require('connect-mongo');
const post = require('./server/modules/data');
const User = require('./server/modules/user');
const { create } = require('connect-mongo');

const session = require('express-session');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 
app.use(over('_methoud'));
const layout = require('express-ejs-layouts');
app.use(layout);
app.use(require('express-ejs-layouts'));
app.set('view engine', 'ejs');
app.set('layout', './layouts/main');

const cookieParser = require('cookie-parser');
const { render } = require('ejs');
app.use(cookieParser());
app.use(session({
    secret: 'key word',
    resave: false, 
    saveUninitialized: true,
    store: mongoConnect.create({
        mongoUrl: process.env.mong
    }),
}));

const port = process.env.PORT || 5087;
const mUrl = process.env.mong;
const mySecret = process.env.Secret;


const auther = (req, res, next) => {
    const token = req.cookies.token; 
    if (!token) {
        console.log("No token found");
        return res.render('unauther'); 
    }

    try {
        const decode = jwt.verify(token, mySecret); 
        req.userId = decode.userId; 
        next(); 
    } catch (err) {
        console.error("Token verification failed:", err);
        return res.render('unauther'); 
    }
};


mongoose.connect(mUrl)
    .then(() => {
        console.log("Connected to MongoDB successfully!");
        app.listen(port, () => {
            console.log(`Server is online on port ${port}`);
        });
    })
    .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
        res.render('404', { reqUrl: "sorry cannot connect to the database" });
    }
);


router.get('/', async (req, res) => {
    try {
        const data = await post.aggregate([{$sort: {createdAt: -1}}]);
        res.render('index', { data });
    } catch (err) {
        res.render('404', { reqUrl: req.url.slice(1) });
    }
});

router.get('/post/:id', auther, async (req, res) => {
    try {
        const id = req.params.id;
        const data = await post.findById({ _id: id });
        res.render('post', { data });
    } catch (err) {
        console.log(err);
        res.render('404', { reqUrl: req.url.slice(1) });
    }
});

router.post('/search', async(req, res) =>{
    try{
        let term = req.body.searchTerm;
        const find = term.replace(/[^a-zA-Z0-9]/g, "");
        const data = await post.find({
        $or: [
            {title: {$regex: new RegExp(find, 'i')}},
            {body: {$regex: new RegExp(find, 'i')}}
        ]
    });
    res.render('search', {find, data});
    }catch(err){
        console.log(err);
    }
});

router.get('/data', async(req, res) => {
    const data = await post.find();
    res.send(data);
});



router.get('/login', async(req, res) => {
    try {
        res.render('admin_index');
    } catch (err) {
        console.log(err);
        res.render('404', { reqUrl: req.url.slice(1) });
    }
});
 
let owner = '';

router.post('/admin', async(req, res) => {
    try {
        const {username, password} = req.body;
        const user = await User.findOne({username});
        owner = username;
        if(!user){
            return res.render('wrong', {msg: "Username not found"});
        }
        const pass = await bcrypt.compare(password, user.password);
        if(!pass){
            return res.render('wrong', {msg: "password did not matched"});
        }

        const myToken = jwt.sign({userId: user._id}, mySecret);
        res.cookie('token', myToken, {httpOnly: true});
        res.redirect('/');

    } catch (err) {
        console.log(err);
        res.render('404', { reqUrl: req.url.slice(1) });
    }
});



router.get('/dashboard', auther, async(req, res) =>{
    try{
        const data = await post.find({author: owner});
        res.render('dashboard', { data });
    }catch(err){
        
    }
});

router.get('/Register', (req, res) =>{
    res.render('Register');
});

router.post('/Register', async(req, res) => {
    try {
        const {username, password} = req.body;
        owner = username;
        const hashedPassword = await bcrypt.hash(password, 10);
        try{
            const user = await User.create({username, password: hashedPassword});
            const myToken = jwt.sign({userId: user._id}, mySecret);
            res.cookie('token', myToken, {httpOnly: true});
            res.redirect('/');
        }catch (err) {
            console.log(err);
            res.render('404', { reqUrl: req.url.slice(1) });
        }
    } catch (err) {
        console.log(err);
        res.render('404', { reqUrl: req.url.slice(1) });
    }
});


router.get('/add-post', auther, async(req, res) => {
    res.render('add-post');
});

router.post('/add-post', auther, async(req, res) =>{
    try{
        const insert = new post({
            title: req.body.title,
            body: req.body.body,
            author: owner
        });
        await post.create(insert);
        res.redirect('/dashboard')
    }catch(err){
        console.log(err);
    }
});


router.put('/edit-post/:id', auther, async (req, res) => {
    try {
        const myId = req.params.id;
        await post.findByIdAndUpdate(myId, {
            title: req.body.title,
            body: req.body.body,
            update: Date.now()
        });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while updating the post.");
    }
});

router.get('/edit-post/:id', auther, async (req, res) => {
    try {
        const myId = req.params.id;
        const data = await post.findOne({_id: myId});

        if (!data) {
            return res.status(404).send("Post not found.");
        }
        res.render('edit-post', { data });
    } catch (err) {
        console.error(err);
        res.status(500).send("An error occurred while fetching the post.");
    }
});


router.post('/delete-post/:id', auther, async (req, res) => {
    try {
        await post.deleteOne({ _id: req.params.id });
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Something went wrong');
    }
});


router.get('/logout', (req, res) =>{
    res.clearCookie('token');
    res.redirect('/');
});

router.use((req, res) => {
    res.render('404', { reqUrl: req.url.slice(1) });
});

console.log(owner);

app.use('/', router);


async function addPost() {
    try {
        await post.insertMany([
            { title: "Journey to the Edge of the Universe 🚀", body: "Have you ever wondered what lies beyond the shimmering stars in the night sky? This plog embarks on a journey across the cosmos, from our solar system to the distant edges of the observable universe. We'll explore some of humanity's most ambitious space missions, including the Voyager probes traveling beyond the heliosphere, and the James Webb Space Telescope that peers billions of years back in time. Imagine the possibilities: exoplanets where alien life might exist, black holes with event horizons that defy understanding, and the bold ideas of interstellar travel through wormholes or warp drives. Whether it's colonizing Mars or discovering the multiverse, the universe beckons us to explore, dream, and reach for the stars." },
            { title: "AI Learns to Dream: The Future of Conscious Machines 🤖", body: "Artificial Intelligence has become a transformative force, revolutionizing industries and everyday life. But what lies ahead when AI goes beyond task completion and starts developing creativity—or even dreams? Imagine a future where AI-generated art rivals human expression, or machines experience dreams, reflecting patterns learned from vast data. This plog delves into AI advancements like generative adversarial networks (GANs), AI-powered art, and the speculative idea of artificial consciousness. We'll also tackle the big questions: What happens if machines start exhibiting emotions or moral reasoning? How do we handle the ethics of AI sentience, and can we trust a world where AI dreams of electric sheep?" },
            { title: "The Ocean's Greatest Mystery: The Colossal Squid 🦑", body: "Beneath the crushing depths of the ocean, where sunlight never reaches, lives one of the most mysterious creatures on Earth: the colossal squid. Measuring up to 14 meters (46 feet) long, these enigmatic giants are rarely encountered, adding to the mystique surrounding them. This plog dives into what scientists know—and don't know—about the colossal squid, including their bioluminescent hunting tactics and the monstrous beak capable of slicing prey with precision. We'll explore thrilling underwater expeditions, such as encounters with colossal squids by deep-sea submersibles, and the challenges of studying these creatures in the vast, dark expanse of the ocean. Are they the inspiration for ancient sea monster myths, or do they guard secrets of the abyss yet to be uncovered?" },
            { title: "The Art of Minimalism: Less is More 🖼️", body: "In a world full of distractions, minimalism offers a refreshing philosophy: focus only on what truly adds value to your life. This plog explores minimalism beyond aesthetics—it's a mindset shift that encourages simplicity and intentional living. We’ll look at minimalist design principles in architecture and fashion, as well as how decluttering your environment can reduce stress and boost productivity. Whether it’s Marie Kondo’s mantra of 'spark joy' or embracing digital minimalism by cutting down on social media, the goal is the same—find clarity through simplicity. Minimalism isn't about deprivation; it's about making space for the things that matter most—be it relationships, creativity, or inner peace." },
            { title: "The Rise of Electric Cars: Driving into the Future 🚗⚡", body: "Electric cars are not just a passing trend—they’re the future of sustainable transportation. With governments worldwide pushing for carbon neutrality and phasing out fossil fuel-powered vehicles, the shift to electric mobility is accelerating. In this plog, we dive into how cutting-edge battery technology is extending vehicle ranges and reducing charging times. We’ll explore advancements in self-driving electric cars, the rapid expansion of charging infrastructure, and how Tesla, Rivian, and legacy automakers like Ford and GM are leading the electric revolution. But the future isn’t without challenges—what about recycling batteries? Can the power grid handle millions of EVs? And what does this transformation mean for global oil markets? Buckle up as we explore the road ahead and how EVs are driving us toward a cleaner, smarter future." }
        ]);
        console.log("Posts inserted successfully!");
    } catch (error) {
        console.error("Error inserting posts:", error);
    }
}

// addPost();