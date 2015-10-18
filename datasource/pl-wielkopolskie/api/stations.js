var requests = require('./requests'),
	channels = require('./channels'),
	config = require('config').datasource['pl-wielkopolskie'],
	q = require('q'),
	redis = require('../../../service/redis');


var entitize = function(apiStation) {
	var id = parseInt(apiStation.browsePath.match(/^\/dane-pomiarowe\/automatyczne\/stacja\/([0-9]+)\/parametry\/wszystkie$/i)[1]);

	return channels.byStationId(id).then(function(channels) {
		return {
			name: apiStation.params.name,
			agglomeration: apiStation.params.agglomeration,
			position: apiStation.position,
			address: apiStation.params.address,
			path: apiStation.browsePath,
			id: id,
			channels: channels
		};
	});
};


var all = function() {
	var fetch = function() {
		return requests.get(
				config.api.paths.stations
			).then(function(html) {
				var mapConfig = eval('({' + html.match(/app\.config\.map = \{([^;]+)\};/i)[1] + '})');

				return q.all(mapConfig.stations.map(entitize));
			});
	};

	return redis.get('api:stations').then(function(stations) {
		if (stations)
			return stations;

		return fetch().then(function(stations) {
			return redis.set(
				'api:stations',
				stations,
				config.stations.cache_ttl
			);
		});
	});
};


var byId = function(id) {
	return all().then(function(stations) {
		return stations.reduce(function(found, station) {
			if (found)
				return found;

			return station.id == id ? station : null;
		}, null);
	});
};


var byChannelId = function(channelId) {
	return all().then(function(stations) {
		return stations.reduce(function(found, station) {
			if (found)
				return found;

			var foundChannels = station.channels.filter(function(channel) {
				return channel.id == channelId;
			});

			if (foundChannels.length)
				return station;

			return null;
		}, null);
	});
};


module.exports = {
	all: all,
	byId: byId,
	byChannelId: byChannelId
};
