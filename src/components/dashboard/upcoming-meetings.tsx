"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, MapPin, ChevronRight } from "lucide-react";
import type { Meeting } from "@/types/dashboard";

interface UpcomingMeetingsProps {
  meetings: Meeting[];
}

export function UpcomingMeetings({ meetings }: UpcomingMeetingsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Επερχόμενα Ραντεβού</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {meetings.map((meeting, index) => (
            <div key={meeting.id} className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {meeting.title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{meeting.time}</span>
                    <span>•</span>
                    <span>{meeting.date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>{meeting.location}</span>
                  </div>
                </div>
              </div>
              {index < meetings.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <Button asChild className="w-full" variant="ghost">
          <Link href="/calendar">
            Προβολή ημερολογίου
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
