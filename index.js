const fs = require('fs')
const path = require('path')
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');

const { makeExecutableSchema } = require('graphql-tools')
const { graphqlExpress } = require('graphql-server-express');
const { GraphQLDateTime } = require('graphql-iso-date');

const fetch = require('node-fetch')
const querystring = require('querystring')

const params = object => {
    const args = {}
    let empty = true
    for (const key in object) {
        if(object[key]) {
            empty = false
            args[key] = object[key]
        }
    }
    return empty ? '' : '?' + querystring.stringify(args)
}

// /users
// /users/?ids[]
// /users/:id
// /posts
// /posts/?ids[]
// /posts/:id
// /posts/:id/comments
const API = 'http://localhost:4567'
const fetchJson = path => fetch(`${API}${path}`).then(r => r.json())

const fetchUser = id => fetchJson(`/users/${id}`)
const fetchUsers = ids => fetchJson(`/users${params({ids})}`)
const fetchUserComments = id => fetchJson(`/users/${id}/comments`)
const fetchUserPosts = id => fetchJson(`/users/${id}/posts`)

const fetchPost = id => fetchJson(`/posts/${id}`)
const fetchPosts = ids => fetchJson(`/posts${params({ids})}`)
const fetchPostComments = id => fetchJson(`/posts/${id}/comments`)

const resolvers = {
    DateTime: GraphQLDateTime,
    Query: {
        users (obj, args) {
            return fetchUsers(args.ids)
        },
        user (obj, args) {
            return fetchUser(args.id)
        },
        post (obj, args) {
            return fetchPost(args.id)
        },
        posts (obj, args) {
            return fetchPosts(args.ids)
        }
    },
    User: {
        posts (obj, args) {
            return fetchUserPosts(obj.id)
        },
        comments (obj, args) {
            return fetchUserComments(obj.id)
        }
    },
    Post: {
        comments (obj, args) {
            return fetchPostComments(obj.id)
        },
        author (obj, args) {
            return fetchUser(obj.authorId)
        }
    },
    Comment: {
        author (obj, args) {
            return fetchUser(obj.authorId)
        },
        post (obj, args) {
            return fetchPost(obj.postId)
        }
    }
}

// schema
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.graphql'), { encoding: 'utf-8' })
const schema = makeExecutableSchema({
    typeDefs,
    resolvers
})

const app = express()
app.use('/', cors(), bodyParser.json({type: '*/*'}), graphqlExpress({schema}))
app.listen(5678)
