var prettyjson = require('prettyjson');

var brtmParser = {

	addObjProperty : function (page, key, obj) {
        if (!obj || !key) {
            console.log("addObjProperty : Cannot save original object without key or the object itself.");
            return;
        }
        // NOTE: this will not work in IE8 and below
        Object.defineProperty(page, key, {
            value : obj,
            writable : false,
            enumerable : true,
            configurable : false
        });
    },

    parseMetrics: function (req, res, next) {
        
        // Number of Metrics Counts
        var count = req.body.bCount;
        console.log("parseMetrics req.body.bCount = " + count);

        if ( !count ) {
            var values = req.body.split('=');
            if (values[0] == 'UB') {  // postData = "UB=true"; // Unsupported Browser
                
                // Nothing to do....Broswer not supported
                // Maybe we log/sned this as well....coudl be good info to know along with user-agent
                res.end();
                return;
            }
        }

        //console.log("parseMetrics req.body.b0 = " + req.body.b0);

        // Posted Data looks like this:
        // {{ bCount=1&b0=g=-255,-255;duration=382;p=Chrome;pv=45;CorBrowsGUID=24510868C0A8001A5F8A138A7CDCF7B4;
        //   artTime=1443718301791$bs=-1,bt=-1,btc=-1,url=localhost/9090|/jtixchange_web/shop/index.shtml;
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Browser Render Time (ms)=(338,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Connection Establishment Time (ms)=(1,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average DNS Lookup Time (ms)=(0,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average DOM Construction Time (ms)=(351,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Page Load Complete Time (ms)=(382,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Previous Page Unload Time (ms)=(36,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Round Trip Time (ms)=(22,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Time to First Byte (ms)=(28,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Average Time to Last Byte (ms)=(29,0);
        //   localhost/9090|/jtixchange_web/shop/index.shtml:Responses Per Interval=(1,1) }}
        

        // Strategy: I will slpit the above line between the token '$bs' 
        // I have already implemented how to handle the second half of this string,
        // just need to handle the first half now
        var index = req.body.b0.indexOf('$bs');
        var firstHalf = req.body.b0.substring(0, index);
        var secondHalf = req.body.b0.substring(index, req.body.b0.length);

        //console.log("Fist Half = " + firstHalf);
        //console.log("Second Half = " + secondHalf);

        var TTOption = [];
        if ( index > 1 ){
            TTOption = firstHalf.split(';');
        }

        var rawMetrics = [];
        rawMetrics = secondHalf.split(';');
        
        // Debuggin Post data
        // for (var i = 0; i < rawMetrics.length; i++) {
        //     console.log("rawMetrics["+ i + "] = " + rawMetrics[i].toString());
        // };

        var newPage = {};

        newPage = brtmParser.parse(TTOption, rawMetrics, req.headers);

        brtmParser.save(newPage);
 
        //res.end();
        res.status(200).end();
        
    },

    parse: function (TTOption, rawMetrics, headers) {

        var page = {"timestamp": new Date()};

        for (var i = 0; i < TTOption.length; i++) {
            console.log('TTOption[' + i + '] = ' + TTOption[i]);
            var keys = TTOption[i].split('=');
            brtmParser.addObjProperty(page, keys[0], keys[1]);
        };

        var firstLine = rawMetrics[0].toString().split(',');
        firstLine.forEach(function(element){
            var item = element.split('=');
            //console.log("Key = " + item[0] + " value = " + item[1]);
            if ( item[0] === 'url')
            {
                var url = item[1].split('|');
                brtmParser.addObjProperty(page, "host", url[0]);
                brtmParser.addObjProperty(page, "url", url[1]);
            }
            else
            {
                if ( item[0].indexOf('$') > -1 ) {
                    item[0] = item[0].substring(1, item[0].length);
                }
                brtmParser.addObjProperty(page, item[0], item[1]);
            }
        }); 

        var url = rawMetrics[1].toString().split(':');
        var metricArray =[];
        for (var i = 1; i < rawMetrics.length; i++) {
            var line = rawMetrics[i].toString().trim();
            metricArray.push(line.substring(url[0].toString().length + 1, line.length));
        };

        //console.log("metricArray = " + metricArray);

        if ( url[0].indexOf('AJAX Call') > 1 )
        {
            //console.log("URL AJAX Call = " + url[0]);
            // extract host and path from url
            var host = url[0].substring(url[0].indexOf('AJAX Call') + 10, url[0].lastIndexOf('|'));
            var path = url[0].substring(url[0].lastIndexOf('|') + 1);

            var ajax_call = {
                "host": host,
                "url": path,
                "metrics": metricArray
            }

            brtmParser.addObjProperty(page, "ajax_calls", ajax_call);
        }
        else if ( url[0].indexOf('JavaScript Function') > 1 )
        {
            //console.log("URL JS FUNCTION = " + url[0]);
            var name = url[0].substring(url[0].lastIndexOf('|') + 1, url[0].length);
            var js_function = {
                "name": name,
                "metrics": metricArray
            }
            brtmParser.addObjProperty(page, "js_function", js_function);
        }
        else
        {
            //console.log("URL METRICS = " + url[0]);
            brtmParser.addObjProperty(page, "metrics", metricArray);
        }

        // Store header info

        var header = {
            "user_agent": headers['user-agent'],
            "referer": headers.referer
        }

        brtmParser.addObjProperty(page, "headers", header);

        // async.setImmediate(function () {
        //   callback(null, page);
        // });

        return page;

    },

    save: function (page, callback) {

    	var options = {
		  noColor: true
		};
		console.log("\n---------------------------------------------------------------------");
        console.log(prettyjson.render(page, options));
        console.log("\n");
        //console.log(JSON.stringify(page)); 

    },


};

module.exports = brtmParser;