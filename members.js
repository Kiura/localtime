const flag = require('country-code-emoji')
const wc = require('which-country')
const ct = require('countries-and-timezones')
const getCountryISO2 = require("country-iso-3-to-2")

const getChatID = function () {
	if (this.from && this.chat) {
		return this.chat.id
	}
	return null
}

const getUserID = function () {
	if (this.from) {
		return this.from.id
	}
	return null
}

const changeUserTimeZone = function (uID, timezone, location) {
	let users = this.session.users || {}
	if (!uID) {
		uID = this.getUserID()
	}
	users[uID].timezone = timezone
	if (!location) {
		const countries = ct.getCountriesForTimezone(timezone)
		users[uID].country = countries[0].id.toUpperCase()
		if (users[uID].country) {
			users[uID].flag = flag(users[uID].country)
		}
	} else {
		const {latitude,longitude} = location
		const country = wc([longitude,latitude])
		if (country) {
			users[uID].country = getCountryISO2(country).toUpperCase()
			users[uID].flag = flag(users[uID].country)
		}
	}
	this.session.users = users
	return true
}

const getUser = function (uID) {
	let users = this.session.users || {}
	if (!uID) {
		uID = this.getUserID()
	}
	return users[uID]
}

const getUserByUsername = function (username) {
	let users = this.session.users || {}
	for (let [key, user] of Object.entries(users)) {
		if (user.user.username === username) return user
	}
	return null
}

module.exports = async function (ctx, next) {
	ctx.getChatID = getChatID
	ctx.getUserID = getUserID
	ctx.changeUserTimeZone = changeUserTimeZone
	ctx.getUser = getUser
	ctx.getUserByUsername = getUserByUsername

	let users = ctx.session.users || {}

	const exists = !!users[ctx.getUserID()]
	const member = await ctx.getChatMember(ctx.getUserID()).catch(() => false)
	if (!member || exists) {
		return next(ctx)
	}

	users[ctx.getUserID()] = member
	ctx.session.users = users
	return next(ctx)
}