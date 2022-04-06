const express = require("express");
const app = express();
const cors = require("cors");
const ytdl = require("ytdl-core");
const fs = require("fs");

const port = 3000;

app.use(cors());

app.use(express.static(__dirname + '/'));

app.get('/mp4', (req,res) => {
	let id = req.query.id
	let url = "https://www.youtube.com/watch?v=" + id;
	var resultText	= '';
	var f = './'+id+'.mp4';
	if (fs.existsSync(f)) {
		//file exists, we're done
		resultText = 'file exists: '+f;
		console.log(resultText);
		res.send(resultText);
	} else {
		//file not exists, it will download
		console.log("downloading...");
		var w = fs.createWriteStream(f);
		ytdl(url, {
			format: 'mp4',
			filter: 'videoonly',			//audio isn't necessary (we will play muted video)
			quality: 'highestvideo'			//4k if available
//			quality: '137'					//1080p
//			quality: '136'					//720p
		}).pipe(w);
		w.on('finish', function(){
			resultText = 'done: '+id+'.mp4';
			console.log(resultText);
			res.send(resultText);
		});
	}
});

app.listen(port, () => {
  console.log(`
  Server is running:
  http://localhost:3000
  `);
});
