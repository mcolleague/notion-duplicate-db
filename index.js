import { Client } from "@notionhq/client"

const notion = new Client({ auth: process.env.NOTION_KEY })

async function migrateSharedTasks(){
    const dbByTitleFilter = (str) => ({ title: [{plain_text}] }) => plain_text === str 

    const dbsSearchObj = { 
        query: '', 
        filter: {
            property: 'object',
            value: 'database'
        }
    }
    const dbsSearch = await notion.search(dbsSearchObj)
    const dbs = dbsSearch.results
    const dbsMap = {
        tasks: {
            main: dbs.find(dbByTitleFilter("Tasks")).id,
            shared: dbs.find(dbByTitleFilter("Tasks (shared)")).id
        },
        projects: {
            main: dbs.find(dbByTitleFilter("Projects")).id
        },
        rules: {
            main: dbs.find(dbByTitleFilter("Rules")).id
        }
    }

    const tasksQuery = await notion.databases.query(
        {
            database_id: dbsMap.tasks.main,
            filter: {
                or: [
                    {
                        property: "Is shared",
                        formula: {
                            checkbox: {
                                equals: true
                            }
                        }
                    }
                ]
            }
        }
    )
    const tasks = tasksQuery.results

    console.log(tasks[0].properties)

    tasks.forEach((task, i) => {
        const props = [
            "Status",
            "Due",
            "Tags",
            "Project",
            "Theme",
            "Assignee",
        ].reduce((prev, key) => {
            const matchedProp = task.properties[key]
            const type = matchedProp?.type
            return matchedProp 
                ? { ...prev, [key]: {[type]: matchedProp[type]} }
                : prev
        }, {
            title: { 
                title: [
                    {
                        "text": {
                            "content": task.properties.Name.title[0].plain_text
                        }
                    }
                ]
            }           
        })

        notion.pages.create({
            parent: { database_id: dbsMap.tasks.shared },
            properties: props      
        })        
    })
}

async function listDatabases() {
    search('', { value: 'database', property: 'object' })
        .then((dbs) => {
            const info = dbs.map(({title, id}) => ({
                id,
                title: title[0].plain_text
            }))
            console.log(info)
        })
}

async function search(query, filter, sort) {
    let search = { query }
    if (filter) search = { ...search, filter }
    if (sort) search = { ...search, sort }

    const response = await notion.search(search)
    const results = await response.results
    return results
}

async function getItems(database_id, filter, sorts) {
    const response = await notion.databases.query({
        database_id
    });
    console.log(response)
}

async function addItem(databaseId, title) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        title: { 
          title:[
            {
              "text": {
                "content": title
              }
            }
          ]
        }
      },
    })
    console.log(response)
    console.log("Success! Entry added.")
  } catch (error) {
    console.error(error.body)
  }
}

// addItem(XXX, "Yurts in Big Sur, California")
// getItems(databaseId)
// listDatabases()
migrateSharedTasks()
