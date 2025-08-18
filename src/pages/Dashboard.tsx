import { useState } from "react";
import { ArrowLeft, Save, Download, Search, Filter, MapPin, Clock, Calendar, Trash2, Edit, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

interface SavedRoute {
  id: string;
  title: string;
  note?: string;
  mode: 'car' | 'walking';
  distance: number;
  duration: number;
  waypoints: number;
  createdAt: string;
  thumbnail?: string;
}

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<'all' | 'car' | 'walking'>('all');
  
  // Mock data for saved routes
  const [savedRoutes] = useState<SavedRoute[]>([
    {
      id: '1',
      title: 'Geschäftsreise Berlin-Paris',
      note: 'Wichtige Meetings in mehreren Städten',
      mode: 'car',
      distance: 1034,
      duration: 585, // minutes
      waypoints: 3,
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      title: 'Wochenendtrip München-Salzburg',
      mode: 'car',
      distance: 145,
      duration: 90,
      waypoints: 1,
      createdAt: '2024-01-10T14:15:00Z'
    },
    {
      id: '3',
      title: 'Stadtrundgang Hamburg',
      note: 'Sehenswürdigkeiten Tour',
      mode: 'walking',
      distance: 8.5,
      duration: 120,
      waypoints: 5,
      createdAt: '2024-01-08T09:00:00Z'
    }
  ]);

  const filteredRoutes = savedRoutes.filter(route => {
    const matchesSearch = route.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (route.note && route.note.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterMode === 'all' || route.mode === filterMode;
    return matchesSearch && matchesFilter;
  });

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  const formatDistance = (distance: number, mode: 'car' | 'walking') => {
    if (mode === 'walking' && distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance}km`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-nav-surface border-b border-nav-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Zurück zur Karte
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Gespeicherte Routen</h1>
                <p className="text-muted-foreground">Verwalten Sie Ihre geplanten Routen</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportieren
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Routen durchsuchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={filterMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('all')}
            >
              Alle
            </Button>
            <Button
              variant={filterMode === 'car' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('car')}
            >
              Auto
            </Button>
            <Button
              variant={filterMode === 'walking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterMode('walking')}
            >
              Zu Fuß
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Gespeicherte Routen</span>
              </div>
              <p className="text-2xl font-bold mt-1">{savedRoutes.length}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-travel" />
                <span className="text-sm text-muted-foreground">Gesamtstrecke</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {savedRoutes.reduce((sum, route) => sum + route.distance, 0).toLocaleString()} km
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" />
                <span className="text-sm text-muted-foreground">Gesamtzeit</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {formatDuration(savedRoutes.reduce((sum, route) => sum + route.duration, 0))}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-secondary-foreground" />
                <span className="text-sm text-muted-foreground">Letzte Route</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {savedRoutes.length > 0 ? formatDate(savedRoutes[0].createdAt) : '-'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Routes List */}
        <div className="space-y-4">
          {filteredRoutes.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Keine Routen gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Versuchen Sie es mit anderen Suchbegriffen.' : 'Erstellen Sie Ihre erste Route, um sie hier zu sehen.'}
                </p>
                <Link to="/">
                  <Button>
                    <MapPin className="h-4 w-4 mr-2" />
                    Route erstellen
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            filteredRoutes.map((route) => (
              <Card key={route.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{route.title}</h3>
                        <Badge variant={route.mode === 'car' ? 'default' : 'secondary'}>
                          {route.mode === 'car' ? 'Auto' : 'Zu Fuß'}
                        </Badge>
                      </div>
                      
                      {route.note && (
                        <p className="text-muted-foreground text-sm mb-3">{route.note}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {formatDistance(route.distance, route.mode)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(route.duration)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {route.waypoints} Zwischenziele
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(route.createdAt)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}