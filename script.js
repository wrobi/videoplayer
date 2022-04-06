let delay = 0;
let start = 0;
let previousTime = -1;
let counter = 0;
let paused = false;
var videoState = "";
var current = 0.00; 	//only for debug
let poller = new SnifferPoller({
	
	// Polling interval in ms
	interval: 30,
	
	// Latency compensation in second
	// If the lyrics are displayed with a delay, this value must be increased
	// It depends on the power of your PC and the usage of your network
	latencyCompensation: 0.250,

	// Time in second for display vocal before lyric start
	preVocalDisplayTime: 2,
	// Time in second for display vocal after lyric end
	postVocalDisplayTime: 0.7,
	// Number of line displayed, This value can be exceeded when it sings fast
	numberOfLinesDisplayed: 2,
	
	// Max note kepping, Use for compatibility with bad length of vocal
	maxNoteKepping: 2.5,
	
	// HTML / CSS customization
	beginLyric: '<span class="lyric">',
	endLyric: '</span>',
	newLine: '<br>',

	onData: function(data) {
		
		// Not in song
		if (data.currentState != STATE_SONG_PLAYING) {
			$(".vocal").html("");
			video.pause();
			return;
		}
		
		let currentTime = data.memoryReadout.songTimer + this.latencyCompensation;
		let vocals = data.songDetails.vocals;
		current = currentTime;

		//start playing video
		if (currentTime >= delay) {
			if (videoState != "play" && videoState != "paused") {
				console.log("play");
				videoState = "play";
				video.currentTime = start + currentTime - delay;
				video.style = "opacity:100%;"
				video.play()
			}
		}
		
		//deternime paused state
		if (currentTime == previousTime) {
			if (!paused) {
				counter++
				if (counter > 10) {
					paused = true;
					video.pause();
					videoState = "paused";
					console.log("paused");
				}
			}
		} else {
			if (currentTime < previousTime) {
				//rewind
				video.currentTime = start + currentTime - delay;
			} else {
				counter = 0;
				if (paused) {
					//continue playig
					console.log("continue");
					videoState = "play";
					video.currentTime = start + currentTime - delay;
					video.play();
					paused = false;
				}
			}
		}
		
		// Song not started or song without vocals
		if (currentTime <= 0 || vocals == null) {
			$(".vocal").html("");
			return;
		}

		// Vocals exist but is empty
		let vocalsLength = vocals.length;
		if (vocalsLength <= 0) {
			$(".vocal").html("");
			return;
		}
		
		// Search pre index. Only for performance
		let part = vocalsLength / 2;
		let index = Math.floor(part);
		while (true) {
			part /= 2;
			if (vocals[index].Time <= currentTime) {
				index = Math.floor(index + part);
				
			} else if (vocals[index].Time > currentTime) {
				index = Math.floor(index - part);
			}
			if (part <= 2 || index <= 0 || index >= vocalsLength) {
				break;
			}
		}
		// Start 40 syllables before current vocal
		// 30 is not enought for japanese language
		index -= 40;
		if (index <= 0) {
			index = 0;
		}

		// State
		let isNextNewLine;
		let isNextWithoutSpace;
		let isEndOfCurrent = false;
		let isNewLineBefore = false;
		let stopAtNextLine = false;

		let vocal;
		let lyric;
		let noteKeeping;
		let timeDifference;
		let currentLine = this.beginLyric;
		let lineNumber = 1;

		const regExStartWithUpperCaseChar = /[A-Z]/;
		
		// TODO don't create a new line when it's start whith "I " or "I'" and the preceded word have a majuscule
		// only in two compatibility process
		
		for (; index < vocalsLength; ++index) {

			// Get state from vocal
			vocal = vocals[index];
			lyric = vocal.Lyric;
			noteKeeping = vocal.Length;
			if (noteKeeping > this.maxNoteKepping) {
				noteKeeping = this.maxNoteKepping;
			}
			
			isNextNewLine = false;
			isNextWithoutSpace = false;
			if (lyric.endsWith("-")) {
				isNextWithoutSpace = true;
			} else if (lyric.endsWith("+")) {
				isNextNewLine = true;
			}
			
			// Remove vocal state from lyric
			if (isNextWithoutSpace || isNextNewLine) {
				lyric = lyric.substr(0, lyric.length-1);
			}
			
			timeDifference = currentTime - vocal.Time;
			if (timeDifference >= 0) {
				
				// Compatibility with Rocksmith song without state in vocal
				if (regExStartWithUpperCaseChar.test(lyric.substr(0, 1))) {
					if (!currentLine.endsWith(this.newLine) && currentLine != this.beginLyric) {
						isNewLineBefore = false;
						currentLine = this.beginLyric;
						lineNumber = 1;
					}
				}

				// Do not display vocals too early
				if (timeDifference + this.preVocalDisplayTime < 0) {
					if (currentLine == this.beginLyric || currentLine.endsWith(this.newLine)) {
						break;
					}
					stopAtNextLine = true;
				}

				// Vocal before current time
				currentLine = currentLine + lyric;
				if (isNextNewLine) {
					// If new line exist before or current vocal is during a lyric who was not terminated
					// and when is finish display a post time defined
					if ((isNewLineBefore || (timeDifference - noteKeeping) >= 0) && (timeDifference - noteKeeping - this.postVocalDisplayTime) >= 0) {
						isNewLineBefore = false;
						currentLine = this.beginLyric;
						lineNumber = 1;
					} else {
						if (stopAtNextLine) {
							break;
						}
						isNewLineBefore = true;
						currentLine += this.newLine;
						++lineNumber;
					}
				} else if (!isNextWithoutSpace) {
					currentLine += ' ';
				}

			} else {
				// Compatibility with Rocksmith song without state in vocal
				if (regExStartWithUpperCaseChar.test(lyric.substr(0, 1))) {
					if (!currentLine.endsWith(this.newLine) && currentLine != this.beginLyric) {
						if (lineNumber >= this.numberOfLinesDisplayed) {
							break;
						}
						currentLine += this.newLine;
						++lineNumber;
					}
				}

				// Do not display vocals too early
				if (timeDifference + this.preVocalDisplayTime < 0) {
					if (currentLine == this.beginLyric || currentLine.endsWith(this.newLine)) {
						break;
					}
					stopAtNextLine = true;
				}
				if (!isEndOfCurrent) {
					currentLine += this.endLyric;
					isEndOfCurrent = true;
				}
				currentLine = currentLine + lyric;
				if (isNextNewLine) {
					if (stopAtNextLine) {
						break;
					}
					currentLine += this.newLine;
					++lineNumber;
				} else if (!isNextWithoutSpace) {
					currentLine += ' ';
				}
				// Limit the number of line displayed
				if (lineNumber >= this.numberOfLinesDisplayed) {
					stopAtNextLine = true;
				}
			}
		}
		$(".vocal").html(currentLine.replaceAccents());

		previousTime = currentTime;
	},
	onSongChanged(song) {
		$(".vocal").html("");
		if (song && song.songName != "") {
			loadVideo(song);
		}
	},
	onSongStarted(f) {

		$(".vocal").html("");
	},
	onStateChanged(oldState, newState) {
		console.log(oldState+'=>'+newState);
		switch ( oldState * 10 + newState) {
			case 34:	//start
			case 24:	//start
				console.log("started");
				if( start > 0 ) {
					video.currentTime = start;
					video.style = "opacity:0%;"
				}
				if (delay > 0) {
					console.log("delay: " + delay.toString());
				}
				break;
			case 41:	//stop
				console.log("stopped");
				videoState = "stopped";
				video.style = "opacity:0%;"
				video.currentTime = 0;
				previousTime = -1;
				paused = false;
				break;
		}
		
	},
	onSongEnded(f) {
		$(".vocal").html("");
		console.log("ended");
		video.style = "opacity:0%;"
		video.currentTime = 0;
	}
});
function loadVideo(song) {
	var name = song.artistName + " - " + song.songName;
	console.log(name);
	//checking song in array
	var index = indexOf2d(songs, name, 0);
	if (index > -1) {
		var id = songs[index][3];
		var fileName = id+'.mp4';
		console.log("filename: "+fileName);
		$.ajax({
			type: 'GET',
			url: "http://localhost:3000/mp4?id="+id,
			complete: function(){
				console.log("ready");
				video.src = fileName;
				video.pause();
				videoState = "loaded";
				start = songs[index][1];
				delay = songs[index][2];
				if( start > 0 ) {
					video.currentTime = start;
					video.style = "opacity:0%;"
				}
			}			
		});
	} else {
		videoState = "not found";
		video.src = '';
	}
}
function indexOf2d(array, search, dim) {
	var index = -1
	for (var i = 0; i < array.length; i++) {
		if (array[i][dim] == search) {
			index = i;
		}
	}
	return index;
}

String.prototype.replaceAccents = function() {
  var replaceString = this;
  var find    = ['Ăˇ','Ă©','Ă¶','ĂĽ','Ăł','Ă‰','Ă–','Ăş','Ă'];
  var replace = ['á' ,'é' ,'ö' ,'ü' ,'ó' ,'É' ,'Ö' ,'ú' ,'í'];
  
  for (var i = 0; i < find.length; i++) {
    replaceString = replaceString.replaceAll(find[i], replace[i]);
  }
  return replaceString;
};

