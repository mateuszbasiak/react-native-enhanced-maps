#import <Foundation/Foundation.h>
typedef struct {double latitude,longitude;} CLLocationCoordinate2D;
static CLLocationCoordinate2D CLLocationCoordinate2DMake(double a,double b){return {a,b};}
typedef struct {CLLocationCoordinate2D sw,ne;} MLNCoordinateBounds;
static MLNCoordinateBounds MLNCoordinateBoundsMake(CLLocationCoordinate2D a,CLLocationCoordinate2D b){return {a,b};}
typedef struct {double top,left,bottom,right;} UIEdgeInsets;
typedef struct {struct {double width,height;} size;} TestBounds;
@interface MLNMapView:NSObject
@property UIEdgeInsets contentInset;
@property TestBounds bounds;
@end
