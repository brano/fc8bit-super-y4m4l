# FC8Bit Super Y4M4L - scoreboard API.
#
# Replaces the Node.js image Fly Launch generated: it scanned the repo root,
# found package.json and assumed the app was the game. `npm run start` serves
# the static game on 5199, while that Dockerfile exposed 3000 and fly.toml
# routes 8080 - three ports, none agreeing, and no .NET anywhere.
#
# The build context is the repo root (that is where Fly deploys from), but only
# server/ is copied in, so the game never reaches the image. .dockerignore keeps
# it out of the context too.
#
# Restore is a separate layer from the source copy so editing Program.cs does
# not re-download the NuGet packages on every build.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY server/Fc8.Scores.csproj server/
RUN dotnet restore server/Fc8.Scores.csproj

COPY server/ server/
RUN dotnet publish server/Fc8.Scores.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./

# Must match internal_port in fly.toml.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# The database lives on the mounted volume: a container filesystem is thrown
# away on every deploy and restart.
ENV Scores__DbPath=/data/scores.db

ENTRYPOINT ["dotnet", "Fc8.Scores.dll"]
