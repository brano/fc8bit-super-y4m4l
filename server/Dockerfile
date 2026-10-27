# FC8Bit Super Y4M4L - scoreboard API image.
#
# Built from server/ as the context, so the game itself is never in the image:
#   fly deploy      (run from this directory)
#
# Restore is a separate layer from the source copy so that editing Program.cs
# does not re-download the NuGet packages on every build.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Fc8.Scores.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish Fc8.Scores.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./

# Fly routes to this port; it must match internal_port in fly.toml.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# The database lives on the mounted volume, not in the image: a container
# filesystem is thrown away on every deploy and restart.
ENV Scores__DbPath=/data/scores.db

ENTRYPOINT ["dotnet", "Fc8.Scores.dll"]
