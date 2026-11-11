export const json = (data, status = 200) => Response.json(data, { status })

export const leerJson = async (request) => {
  try { return (await request.json()) || {} } catch { return {} }
}
