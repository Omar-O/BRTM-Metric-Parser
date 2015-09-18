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
        //console.log("Num of Metric Count = " + count);

        // Posted Data with all the Metrics, separated by ';'
        var rawMetrics = [];
        rawMetrics = req.body.b0.split(';');
        //console.log("rawMetrics[] = " + rawMetrics.toString());

        // First line
        // $bs=-1,bt=-1,btc=-1,url=localhost/9090|/jtixchange_web/shop/index.shtml
        var firstLine = rawMetrics[0].toString().split(',');

        // Make sure the format is what we expect, else return some sort of error
        var url = rawMetrics[1].toString().split(':');
        if ( !firstLine|| !url[0] || !url[1] )
        {
            //Log error or something
            res.end();
            //res.status(500).end('Unrecognized Metric Format');
            res.status(403).send('Unrecognized Metric Format');

            return;
        }

        var newPage = {"page": "uninitialized"};

        newPage = brtmParser.parse(url, rawMetrics, req.headers);

        brtmParser.save(newPage);

        req.parsedPage = "BRTM Metrics have been Parsed!!!";
 
        res.end();
        res.status(200).end();
        
    },

    parse: function (url, rawMetrics, headers, callback) {

        var page = {"timestamp": new Date()};

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
                brtmParser.addObjProperty(page, item[0], item[1]);
            }
        }); 

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
            "user-agent": headers['user-agent'],
            "referer": headers.referer
        }

        brtmParser.addObjProperty(page, "headers", header);

        // async.setImmediate(function () {
        //   callback(null, page);
        // });

        return page;

    },

    save: function (page, callback) {

        //console.log("Saving page:");
        console.log(JSON.stringify(page)); 

        // async.setImmediate(function () {
        //   callback();
        // });
    },


};

module.exports = brtmParser;