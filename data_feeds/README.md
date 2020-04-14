url:
https://api.santiment.net/graphiql?variables=%7B%7D&query=%7B%0A%20%20getMetric(metric%3A%20%22price_usd_5m%22)%20%7B%0A%20%20%20%20timeseriesData(%0A%20%20%20%20%20%20slug%3A%20%22ethereum%22%0A%20%20%20%20%20%20from%3A%20%222019-11-01T07%3A00%3A00Z%22%0A%20%20%20%20%20%20to%3A%20%222019-12-01T07%3A00%3A00Z%22%0A%20%20%20%20%20%20interval%3A%20%225m%22%0A%20%20%20%20)%20%7B%0A%20%20%20%20%20%20datetime%0A%20%20%20%20%20%20value%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D



runs query
{
  getMetric(metric: "price_usd_5m") {
    timeseriesData(
      slug: "ethereum"
      from: "2019-11-01T07:00:00Z"
      to: "2019-12-01T07:00:00Z"
      interval: "5m"
    ) {
      datetime
      value
    }
  }
}